const { getSettings } = require('../models/super-admin-models/billingSettingsModel');

/**
 * Calculates the tax amount and total amount for an invoice.
 * Fetches the tax rate dynamically from Super Admin settings.
 * @param {number} amount - The base subscription amount.
 * @returns {Promise<{tax_amount: number, total_amount: number, tax_rate_display: string}>}
 */
const calculateTaxAndTotal = async (amount) => {
  const baseAmount = parseFloat(amount);

  // Fetch the global settings for the dynamic tax rate
  const settings = await getSettings();
  // Ensure taxRate is a valid number, default to 0.00
  const TAX_RATE = parseFloat(settings?.tax_rate) || 0.00;

  // Format the rate for display (e.g., 0.05 -> "5.00")
  const taxRateDisplay = (TAX_RATE * 100).toFixed(2);

  if (isNaN(baseAmount) || baseAmount < 0) {
    return { tax_amount: 0, total_amount: 0, tax_rate_display: taxRateDisplay };
  }

  const taxAmount = baseAmount * TAX_RATE;
  const totalAmount = baseAmount + taxAmount;

  // Use toFixed(2) and parseFloat to ensure standard currency precision
  return {
    tax_amount: parseFloat(taxAmount.toFixed(2)),
    total_amount: parseFloat(totalAmount.toFixed(2)),
    tax_rate_display: taxRateDisplay
  };
};

module.exports = { calculateTaxAndTotal };