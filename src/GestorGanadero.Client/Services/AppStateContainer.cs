using System;
using System.Collections.Generic;
using GestorGanadero.Services.Common.Contracts;
using GestorGanadero.Services.Identity.Contracts;
using GestorGanadero.Services.Catalog.Contracts;
using GestorGanadero.Services.Operations.Contracts;
using GestorGanadero.Services.Reporting.Contracts;
using GestorGanadero.Services.Sync.Contracts;

namespace GestorGanadero.Client.Services
{
    public class DateRange
    {
        public DateTime Start { get; set; }
        public DateTime End { get; set; }
    }

    public class AppStateContainer
    {
        private string _activeTenantId = string.Empty;
        private string _activeTenantName = string.Empty;
        private UserProfile? _currentUser;
        private DateRange? _activeDateRange;
        private List<TenantMessage> _availableTenants = new();

        public string ActiveTenantId
        {
            get => _activeTenantId;
            set
            {
                _activeTenantId = value;
                NotifyStateChanged();
            }
        }

        public string ActiveTenantName
        {
            get => _activeTenantName;
            set
            {
                _activeTenantName = value;
                NotifyStateChanged();
            }
        }

        public UserProfile? CurrentUser
        {
            get => _currentUser;
            set
            {
                _currentUser = value;
                NotifyStateChanged();
            }
        }

        public List<TenantMessage> AvailableTenants
        {
            get => _availableTenants;
            set
            {
                _availableTenants = value;
                NotifyStateChanged();
            }
        }

        public DateRange? ActiveDateRange
        {
            get => _activeDateRange;
            set
            {
                _activeDateRange = value;
                NotifyStateChanged();
            }
        }

        public event Action? OnChange;

        private void NotifyStateChanged() => OnChange?.Invoke();
    }
}


