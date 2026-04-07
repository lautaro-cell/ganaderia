using Grpc.Core;
using System;
using System.Threading.Tasks;

// Base helper for gRPC calls from client modules.
public class GrpcClientBase
{
  private readonly TenantState _tenantState;
  public GrpcClientBase(TenantState tenantState)
  {
    _tenantState = tenantState;
  }

  // Expose tenant for header injection in concrete clients
  protected string TenantId => _tenantState?.ActiveTenantId ?? string.Empty;

  // Attach tenant-id header to outgoing calls
  protected CallOptions WithTenantHeader(CallOptions options)
  {
    var headers = options.Headers ?? new Metadata();
    if (!string.IsNullOrEmpty(TenantId))
    {
      var exists = false;
      foreach (var m in headers)
      {
        if (string.Equals(m.Key, "X-Tenant-Id", StringComparison.OrdinalIgnoreCase)) { exists = true; break; }
      }
      if (!exists)
      {
        headers.Add("X-Tenant-Id", TenantId);
      }
    }
    return new CallOptions(headers, options.Deadline, options.CancellationToken, options.WriteOptions);
  }

  // Generic wrapper for gRPC calls returning TResponse
  protected async Task<AppResult<TResponse>> CallAsync<TResponse>(Func<Task<TResponse>> grpcCall)
  {
    try
    {
      var resp = await grpcCall();
      return AppResult<TResponse>.SuccessResult(resp);
    }
    catch (RpcException ex)
    {
      return AppResult<TResponse>.Failure(ex.Status.Detail);
    }
    catch (Exception ex)
    {
      return AppResult<TResponse>.Failure(ex.Message);
    }
  }
}

