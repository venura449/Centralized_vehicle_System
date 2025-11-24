function normalizeTelemetryRow(row) {
  if (!row) {
    return row;
  }

  const normalized = { ...row };

  if ('lambda_value' in normalized) {
    normalized.lambda = normalized.lambda_value;
    delete normalized.lambda_value;
  }

  return normalized;
}

module.exports = {
  normalizeTelemetryRow
};


