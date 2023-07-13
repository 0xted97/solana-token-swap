use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, TokenAccount, Transfer};

use crate::{curve::calculator::TradeDirection, errors::SwapError, states::amm::*, utils::*};

pub fn swap(ctx: Context<Swap>, amount_in: u64, minimum_amount_out: u64) -> Result<()> {
    let amm = &mut ctx.accounts.amm;

    if amm.to_account_info().owner != ctx.program_id {
        return Err(ProgramError::IncorrectProgramId.into());
    }
    if ctx.accounts.swap_authority.key()
        != authority_id(ctx.program_id, amm.to_account_info().key, amm.bump_seed)?
    {
        return Err(SwapError::InvalidProgramAddress.into());
    }
    if !(*ctx.accounts.swap_source.to_account_info().key == amm.token_a_account
        || *ctx.accounts.swap_source.to_account_info().key == amm.token_b_account)
    {
        return Err(SwapError::IncorrectSwapAccount.into());
    }
    if !(*ctx.accounts.swap_destination.to_account_info().key == amm.token_a_account
        || *ctx.accounts.swap_destination.to_account_info().key == amm.token_b_account)
    {
        return Err(SwapError::IncorrectSwapAccount.into());
    }
    if *ctx.accounts.swap_source.to_account_info().key
        == *ctx.accounts.swap_destination.to_account_info().key
    {
        return Err(SwapError::InvalidInput.into());
    }
    if ctx.accounts.swap_source.to_account_info().key == ctx.accounts.source_info.key {
        return Err(SwapError::InvalidInput.into());
    }
    if ctx.accounts.swap_destination.to_account_info().key == ctx.accounts.destination_info.key {
        return Err(SwapError::InvalidInput.into());
    }
    if *ctx.accounts.pool_mint.to_account_info().key != amm.pool_mint {
        return Err(SwapError::IncorrectPoolMint.into());
    }
    if *ctx.accounts.fee_account.to_account_info().key != amm.pool_fee_account {
        return Err(SwapError::IncorrectFeeAccount.into());
    }
    if *ctx.accounts.token_program.key != amm.token_program_id {
        return Err(SwapError::IncorrectTokenProgramId.into());
    }

    let trade_direction = if *ctx.accounts.swap_source.to_account_info().key == amm.token_a_account
    {
        TradeDirection::AtoB
    } else {
        TradeDirection::BtoA
    };
    let curve = build_curve(amm.constant_price).unwrap();
    let fees = build_fees(&amm.fees_input).unwrap();

    let result = curve
        .swap(
            u128::try_from(amount_in).unwrap(),
            u128::try_from(ctx.accounts.swap_source.amount).unwrap(),
            u128::try_from(ctx.accounts.swap_destination.amount).unwrap(),
            trade_direction,
            &fees,
        )
        .ok_or(SwapError::ZeroTradingTokens)?;

    // Check slipped
    if result.destination_amount_swapped < u128::try_from(minimum_amount_out).unwrap() {
        return Err(SwapError::ExceededSlippage.into());
    }
    let (swap_token_a_amount, swap_token_b_amount) = match trade_direction {
        TradeDirection::AtoB => (
            result.new_swap_source_amount,
            result.new_swap_destination_amount,
        ),
        TradeDirection::BtoA => (
            result.new_swap_destination_amount,
            result.new_swap_source_amount,
        ),
    };
    let seeds = &[&amm.to_account_info().key.to_bytes(), &[amm.bump_seed][..]];

    token::transfer(
        ctx.accounts
            .into_transfer_to_swap_source_context()
            .with_signer(&[&seeds[..]]),
        u64::try_from(result.source_amount_swapped).unwrap(),
    )?;

    let mut pool_token_amount = curve
        .withdraw_single_token_type_exact_out(
            result.owner_fee,
            swap_token_a_amount,
            swap_token_b_amount,
            u128::try_from(ctx.accounts.pool_mint.supply).unwrap(),
            trade_direction,
            &fees,
        )
        .ok_or(SwapError::FeeCalculationFailure)?;
    
    msg!("pool_token_amount:{}", pool_token_amount)
    if pool_token_amount > 0 {
        // Allow error to fall through
        if *ctx.accounts.host_fee_account.key != Pubkey::new_from_array([0; 32]) {
            let host = Account::<TokenAccount>::try_from(&ctx.accounts.host_fee_account)?;
            if *ctx.accounts.pool_mint.to_account_info().key != host.mint {
                return Err(SwapError::IncorrectPoolMint.into());
            }
            let host_fee = fees
                .host_fee(pool_token_amount)
                .ok_or(SwapError::FeeCalculationFailure)?;
            if host_fee > 0 {
                pool_token_amount = pool_token_amount
                    .checked_sub(host_fee)
                    .ok_or(SwapError::FeeCalculationFailure)?;
                token::mint_to(
                    ctx.accounts
                        .into_mint_to_host_context()
                        .with_signer(&[&seeds[..]]),
                    u64::try_from(host_fee).unwrap(),
                )?;
            }
        }
        token::mint_to(
            ctx.accounts
                .into_mint_to_pool_context()
                .with_signer(&[&seeds[..]]),
            u64::try_from(pool_token_amount).unwrap(),
        )?;
    }

    token::transfer(
        ctx.accounts
            .into_transfer_to_destination_context()
            .with_signer(&[&seeds[..]]),
        u64::try_from(result.destination_amount_swapped).unwrap(),
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct Swap<'info> {
    /// CHECK: Safe
    pub swap_authority: AccountInfo<'info>,
    pub amm: Account<'info, Amm>,

    /// CHECK: Safe
    #[account(signer)]
    pub user_transfer_authority: AccountInfo<'info>,

    /// CHECK: Safe
    #[account(mut)]
    pub source_info: AccountInfo<'info>,
    /// CHECK: Safe
    #[account(mut)]
    pub destination_info: AccountInfo<'info>,
    #[account(mut)]
    pub swap_source: Account<'info, TokenAccount>,
    #[account(mut)]
    pub swap_destination: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_mint: Account<'info, Mint>,
    #[account(mut)]
    pub fee_account: Account<'info, TokenAccount>,
    /// CHECK: Safe
    pub token_program: AccountInfo<'info>,
    /// CHECK: Safe
    pub host_fee_account: AccountInfo<'info>,
}

impl<'info> Swap<'info> {
    fn into_transfer_to_swap_source_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.source_info.clone(),
            to: self.swap_source.to_account_info().clone(),
            authority: self.user_transfer_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_transfer_to_destination_context(
        &self,
    ) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
        let cpi_accounts = Transfer {
            from: self.swap_destination.to_account_info().clone(),
            to: self.destination_info.clone(),
            authority: self.swap_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_mint_to_host_context(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.pool_mint.to_account_info().clone(),
            to: self.host_fee_account.clone(),
            authority: self.swap_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }

    fn into_mint_to_pool_context(&self) -> CpiContext<'_, '_, '_, 'info, MintTo<'info>> {
        let cpi_accounts = MintTo {
            mint: self.pool_mint.to_account_info().clone(),
            to: self.fee_account.to_account_info().clone(),
            authority: self.swap_authority.clone(),
        };
        CpiContext::new(self.token_program.clone(), cpi_accounts)
    }
}
