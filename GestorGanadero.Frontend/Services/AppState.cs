using System;

namespace GestorGanadero.Frontend.Services;

public class AppState
{
    public event Action? OnChange;

    private string? _selectedTenantId;
    public string? SelectedTenantId
    {
        get => _selectedTenantId;
        set
        {
            if (_selectedTenantId != value)
            {
                _selectedTenantId = value;
                NotifyStateChanged();
            }
        }
    }

    private string? _authToken;
    public string? AuthToken
    {
        get => _authToken;
        set
        {
            if (_authToken != value)
            {
                _authToken = value;
                NotifyStateChanged();
            }
        }
    }

    private DateTime _filterDate = DateTime.Today;
    public DateTime FilterDate
    {
        get => _filterDate;
        set
        {
            if (_filterDate != value)
            {
                _filterDate = value;
                NotifyStateChanged();
            }
        }
    }

    private void NotifyStateChanged() => OnChange?.Invoke();
}
