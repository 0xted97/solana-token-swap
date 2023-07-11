use anchor_lang::prelude::*;

use crate::curve::{base::{CurveType, SwapCurve}, calculator::CurveCalculator, constant_price::ConstantPriceCurve, fees::CurveFees};



/// Build Curve object and Fee object
pub fn build_curve(constant_price: u64) -> Result<SwapCurve> {
    let curve_type = CurveType::try_from(1).unwrap();
    let calculator: Box<dyn CurveCalculator>  = Box::new(ConstantPriceCurve {
        token_b_price: constant_price,
    });
    let curve = SwapCurve {
        curve_type, // Always 1 (Constant Price)
        calculator,
    };
    Ok(curve)
}

pub fn build_fees(fees_input: &FeesInput)-> Result<CurveFees> {
    let fees = CurveFees{
        trade_fee_numerator: fees_input.trade_fee_numerator,
        trade_fee_denominator: fees_input.trade_fee_denominator,
        owner_trade_fee_numerator: fees_input.owner_trade_fee_numerator,
        owner_trade_fee_denominator: fees_input.owner_trade_fee_denominator,
        owner_withdraw_fee_numerator: fees_input.owner_withdraw_fee_numerator,
        owner_withdraw_fee_denominator: fees_input.owner_withdraw_fee_denominator,
        host_fee_numerator: fees_input.host_fee_numerator,
        host_fee_denominator: fees_input.host_fee_denominator,
    };

    Ok(fees)
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct FeesInput {
    pub trade_fee_numerator: u64,
    pub trade_fee_denominator: u64,
    pub owner_trade_fee_numerator: u64,
    pub owner_trade_fee_denominator: u64,
    pub owner_withdraw_fee_numerator: u64,
    pub owner_withdraw_fee_denominator: u64,
    pub host_fee_numerator: u64,
    pub host_fee_denominator: u64,
}

#[account]
pub struct Amm {
    pub is_initialized: bool,
    pub bump_seed: u8,


    pub pool_mint: Pubkey,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    

    pub token_a_account: Pubkey,
    pub token_b_account: Pubkey,
    pub pool_fee_account: Pubkey,


    pub fees_input: FeesInput,
    pub constant_price: u64,

    // Token program ID
    pub token_program_id: Pubkey,
}