use anchor_lang::prelude::*;
use instructions::*;
use states::*;

pub mod curve;
pub mod errors;
pub mod instructions;
pub mod states;
pub mod utils;

declare_id!("GhYNz1LcUJgRYC6D6Qn4jfkAg7hgTrzuoT53QcnmJb5V");

#[program]
pub mod solana_swap {
    use super::*;

    pub fn setup_pool(
        ctx: Context<SetupPool>,
        fees_input: FeesInput,
        constant_price: u64,
    ) -> Result<()> {
        instructions::setup_pool::setup_pool(ctx, fees_input, constant_price)?;
        msg!("Initialized");
        Ok(())
    }

    pub fn deposit_all_token_types(
        ctx: Context<DepositAllTokenTypes>,
        pool_token_amount: u64,
        maximum_token_a_amount: u64, // SOl
        maximum_token_b_amount: u64, // SPL Token
    ) -> Result<()> {
        instructions::provide_liquidity::deposit_all_token_types(ctx, pool_token_amount, maximum_token_a_amount, maximum_token_b_amount)?;
        msg!("Provided");
        Ok(())
    }

    pub fn swap(ctx: Context<Swap>, amount_in: u64, minimum_amount_out: u64) -> Result<()> {
        instructions::swap::swap(ctx, amount_in, minimum_amount_out)?;
        msg!("Swap");
        Ok(())
    }
}
