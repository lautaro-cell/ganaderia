using System.Threading.Tasks;
using GestorGanadero.Services.Catalog.Contracts;
using GestorGanadero.Services.Common.Contracts;
using Grpc.Core;

namespace GestorGanadero.Client.Catalog
{
    public class CatalogClientService
    {
        private readonly CatalogService.CatalogServiceClient _client;

        public CatalogClientService(CatalogService.CatalogServiceClient client)
        {
            _client = client;
        }

        public async Task<AppResult<FieldList>> GetFieldsAsync(GetCatalogRequest req)
        {
            try { return AppResult<FieldList>.SuccessResult(await _client.GetFieldsAsync(req)); }
            catch (RpcException e) { return AppResult<FieldList>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<LoteList>> GetLotesAsync(GetLotesRequest req)
        {
            try { return AppResult<LoteList>.SuccessResult(await _client.GetLotesAsync(req)); }
            catch (RpcException e) { return AppResult<LoteList>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<ActivityList>> GetActivitiesAsync(GetCatalogRequest req)
        {
            try { return AppResult<ActivityList>.SuccessResult(await _client.GetActivitiesAsync(req)); }
            catch (RpcException e) { return AppResult<ActivityList>.Failure(e.Status.Detail); }
        }

        public async Task<AppResult<AnimalCategoryList>> GetAnimalCategoriesAsync(GetCatalogRequest req)
        {
            try { return AppResult<AnimalCategoryList>.SuccessResult(await _client.GetAnimalCategoriesAsync(req)); }
            catch (RpcException e) { return AppResult<AnimalCategoryList>.Failure(e.Status.Detail); }
        }
    }
}
