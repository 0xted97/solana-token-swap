use anchor_lang::prelude::*;

declare_id!("GhYNz1LcUJgRYC6D6Qn4jfkAg7hgTrzuoT53QcnmJb5V");

#[program]
pub mod solana_swap {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
