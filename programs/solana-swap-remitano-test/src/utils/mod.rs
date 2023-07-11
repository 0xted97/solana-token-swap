use anchor_lang::prelude::*;

use crate::{errors::SwapError, states::amm::*, accounts::Swap};


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
    if token_b_info.key() != amm.token_b_mint.key() {
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
