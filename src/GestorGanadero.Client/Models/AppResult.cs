public class AppResult<T>
{
  public bool Success { get; set; }
  public string Message { get; set; } = string.Empty;
  public string? ObjectId { get; set; }
  public T? Data { get; set; }

  public static AppResult<T> SuccessResult(T? data = default, string? message = null, string? objectId = null)
  {
    return new AppResult<T> { Success = true, Data = data, Message = message ?? "OK", ObjectId = objectId };
  }

  public static AppResult<T> Failure(string message)
  {
    return new AppResult<T> { Success = false, Message = message };
  }
}
