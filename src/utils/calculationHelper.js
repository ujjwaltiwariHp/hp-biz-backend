const TAX_RATE = 0.00; // 0% tax rate as a default placeholder

/**
 * Calculates the tax amount and total amount for an invoice.
 * Uses a default tax rate of 0.00 (0%).
 * @param {number} amount - The base subscription amount.
 * @returns {{tax_amount: number, total_amount: number}}
 */
const calculateTaxAndTotal = (amount) => {
  const baseAmount = parseFloat(amount);

  if (isNaN(baseAmount) || baseAmount < 0) {
    return { tax_amount: 0, total_amount: 0 };
  }

  const taxAmount = baseAmount * TAX_RATE;
  const totalAmount = baseAmount + taxAmount;

  // Use toFixed(2) and parseFloat to ensure standard currency precision
  return {
    tax_amount: parseFloat(taxAmount.toFixed(2)),
    total_amount: parseFloat(totalAmount.toFixed(2))
  };
};

module.exports = { calculateTaxAndTotal };
