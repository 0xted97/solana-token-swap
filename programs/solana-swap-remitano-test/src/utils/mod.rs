use anchor_lang::prelude::*;

use crate::{errors::SwapError, states::amm::*, curve::{fees::CurveFees, base::{CurveType, SwapCurve}}};

pub struct SwapConstraints<'a> {
    /// Owner of the program
    pub owner_key: &'a str,
    /// Valid curve types
    pub valid_curve_types: &'a [CurveType],
    /// Valid fees
    pub fees: &'a CurveFees,
}

pub const SWAP_CONSTRAINTS: Option<SwapConstraints> = {
    #[cfg(feature = "production")]
    {
        Some(SwapConstraints {
            owner_key: OWNER_KEY,
            valid_curve_types: VALID_CURVE_TYPES,
            fees: FEES,
        })
    }
    #[cfg(not(feature = "production"))]
    {
        None
    }
};

impl<'a> SwapConstraints<'a> {
    /// Checks that the provided curve is valid for the given constraints
    pub fn validate_curve(&self, swap_curve: &SwapCurve) -> Result<()> {
        if self
            .valid_curve_types
            .iter()
            .any(|x| *x == swap_curve.curve_type)
        {
            Ok(())
        } else {
            Err(SwapError::UnsupportedCurveType.into())
        }
    }

    /// Checks that the provided curve is valid for the given constraints
    pub fn validate_fees(&self, fees: &CurveFees) -> Result<()> {
        if fees.trade_fee_numerator >= self.fees.trade_fee_numerator
            && fees.trade_fee_denominator == self.fees.trade_fee_denominator
            && fees.owner_trade_fee_numerator >= self.fees.owner_trade_fee_numerator
            && fees.owner_trade_fee_denominator == self.fees.owner_trade_fee_denominator
            && fees.owner_withdraw_fee_numerator >= self.fees.owner_withdraw_fee_numerator
            && fees.owner_withdraw_fee_denominator == self.fees.owner_withdraw_fee_denominator
            && fees.host_fee_numerator == self.fees.host_fee_numerator
            && fees.host_fee_denominator == self.fees.host_fee_denominator
        {
            Ok(())
        } else {
            Err(SwapError::InvalidFee.into())
        }
    }
}

#[allow(clippy::too_many_arguments)]
pub fn check_accounts(
    amm: &Amm,
    program_id: Pubkey,
    amm_account_info: AccountInfo,
    authority_info: AccountInfo,
    token_a_info: AccountInfo,
    token_b_info: AccountInfo,
    pool_mint_info: AccountInfo,
    token_program_info: AccountInfo,
    user_token_a_info: Option<AccountInfo>,
    user_token_b_info: Option<AccountInfo>,
    pool_fee_account_info: Option<AccountInfo>,
) -> Result<()> {
    if amm_account_info.owner.key() != program_id {
        return Err(ProgramError::IncorrectProgramId.into());
    }
    if authority_info.key() != authority_id(&program_id, &amm_account_info.key(), amm.bump_seed)? {
        return Err(SwapError::InvalidProgramAddress.into());
    }
    if token_a_info.key() != amm.token_a_account.key() {
        return Err(SwapError::IncorrectSwapAccount.into());
    }
    if token_b_info.key() != amm.token_b_account.key() {
        return Err(SwapError::IncorrectSwapAccount.into());
    }
    if pool_mint_info.key() != amm.pool_mint.key() {
        return Err(SwapError::IncorrectPoolMint.into());
    }
    if token_program_info.key() != amm.token_program_id.key() {
        return Err(SwapError::IncorrectTokenProgramId.into());
    }
    if let Some(user_token_a_info) = user_token_a_info {
        if token_a_info.key() == user_token_a_info.key() {
            return Err(SwapError::InvalidInput.into());
        }
    }
    if let Some(user_token_b_info) = user_token_b_info {
        if token_b_info.key() == user_token_b_info.key() {
            return Err(SwapError::InvalidInput.into());
        }
    }
    if let Some(pool_fee_account_info) = pool_fee_account_info {
        if pool_fee_account_info.key() != amm.pool_fee_account.key() {
            return Err(SwapError::IncorrectFeeAccount.into());
        }
    }
    Ok(())
}

/// Calculates the authority id by generating a program address.
pub fn authority_id(program_id: &Pubkey, my_info: &Pubkey, bump_seed: u8) -> Result<Pubkey> {
    Pubkey::create_program_address(&[&my_info.to_bytes()[..32], &[bump_seed]], program_id)
        .or(Err(SwapError::InvalidProgramAddress.into()))
}
