let map;
let drawControl;
let drawnItems;
let dotNetHelper;

window.initMap = (tileUrl, dotNetInstance) => {
    dotNetHelper = dotNetInstance;

    map = L.map('map').setView([-38, -65], 5);

    L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: true,
                shapeOptions: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e60000'
                }
            },
            polyline: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false
        }
    });

    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, function (event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);

        const geojson = layer.toGeoJSON();
        // El loteId lo pasaremos luego en la UI de Blazor tras el dibujo o lo pediremos
        // Por ahora lo mandamos al .NET con un ID placeholder o nulo para que el usuario elija
        dotNetHelper.invokeMethodAsync('OnPolygonDrawn', JSON.stringify(geojson));
    });
};

window.addLotePolygon = (id, name, geojsonStr) => {
    try {
        const geojson = JSON.parse(geojsonStr);
        const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e60000';

        const layer = L.geoJSON(geojson, {
            style: {
                color: accentColor,
                fillColor: accentColor,
                fillOpacity: 0.3,
                weight: 2
            }
        });

        layer.bindPopup(`<b>${name}</b>`);
        layer.addTo(map);
    } catch (e) {
        console.error("Error adding polygon:", e);
    }
};
