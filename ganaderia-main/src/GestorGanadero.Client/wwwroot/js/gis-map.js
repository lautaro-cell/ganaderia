let map;
let drawControl;
let drawnItems;

export function initMap(elementId) {
    map = L.map(elementId).setView([-34.6037, -58.3816], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
}

export function startDrawing() {
    const polygonDrawer = new L.Draw.Polygon(map);
    polygonDrawer.enable();

    map.on(L.Draw.Event.CREATED, function (event) {
        drawnItems.clearLayers();
        const layer = event.layer;
        drawnItems.addLayer(layer);
    });
}

export function getGeometry() {
    return JSON.stringify(drawnItems.toGeoJSON());
}
