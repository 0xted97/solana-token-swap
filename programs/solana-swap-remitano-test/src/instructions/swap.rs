use anchor_lang::prelude::*;

pub fn swap(ctx: Context<Swap>,amount_in: u64, minimum_amount_out: u64) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}
