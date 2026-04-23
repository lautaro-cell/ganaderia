namespace App.Domain.Exceptions;

public class UnbalancedAccountingEntryException : InvalidOperationException
{
    public decimal TotalDebit { get; }
    public decimal TotalCredit { get; }
    public decimal Difference { get; }

    public UnbalancedAccountingEntryException(decimal totalDebit, decimal totalCredit)
        : base($"Asiento descuadrado: DEBE={totalDebit:F2}, HABER={totalCredit:F2}, diferencia={Math.Abs(totalDebit - totalCredit):F2}")
    {
        TotalDebit = totalDebit;
        TotalCredit = totalCredit;
        Difference = totalDebit - totalCredit;
    }
}
