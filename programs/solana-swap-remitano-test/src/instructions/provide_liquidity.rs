use anchor_lang::prelude::*;

pub fn provide_liquidity(ctx: Context<ProvideLiquidity>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct ProvideLiquidity<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
}
