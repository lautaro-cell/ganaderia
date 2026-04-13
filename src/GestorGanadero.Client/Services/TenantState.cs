using System;
using System.Collections.Generic;

public class TenantState
{
  public string ActiveTenantId { get; private set; } = string.Empty;
  public List<string> Tenants { get; } = new List<string> { "TenantA", "TenantB" };

  public event Action? OnChange;

  public void SetTenant(string tenantId)
  {
    ActiveTenantId = tenantId;
    OnChange?.Invoke();
  }
}

