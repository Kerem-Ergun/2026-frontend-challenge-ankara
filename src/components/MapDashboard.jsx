import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatJotformDate } from '../utils/dateTime';
import './MapDashboard.css';

const ANKARA_CENTER = [39.9334, 32.8597];
const DEFAULT_ZOOM = 12;
const FOCUS_ZOOM = 15;

const createDivIcon = (type) =>
    L.divIcon({
        className: `map-event-marker map-event-marker--${type}`,
        html: `<span>${type === 'sighting' ? 'S' : 'C'}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -12]
    });

const MapFocusController = ({ selectedEvent }) => {
    const map = useMap();

    useEffect(() => {
        if (!selectedEvent) return;
        map.flyTo([selectedEvent.lat, selectedEvent.lng], FOCUS_ZOOM, { duration: 0.7 });
    }, [map, selectedEvent]);

    return null;
};

const MapDashboard = ({ events = [], selectedEventId = null, onMarkerSelect = () => { } }) => {
    const icons = useMemo(
        () => ({
            sighting: createDivIcon('sighting'),
            checkin: createDivIcon('checkin')
        }),
        []
    );

    const selectedEvent = events.find((event) => event.id === selectedEventId) || null;
    const routePositions = events.map((event) => [event.lat, event.lng]);

    return (
        <div className="map-dashboard">
            <MapContainer
                center={selectedEvent ? [selectedEvent.lat, selectedEvent.lng] : ANKARA_CENTER}
                zoom={DEFAULT_ZOOM}
                scrollWheelZoom
                className="suspect-map"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapFocusController selectedEvent={selectedEvent} />

                {events.map((event) => (
                    <Marker
                        key={event.id}
                        position={[event.lat, event.lng]}
                        icon={icons[event.type] || icons.sighting}
                        eventHandlers={{
                            click: () => {
                                onMarkerSelect(event.id);
                            }
                        }}
                    >
                        <Popup>
                            <div className="map-popup">
                                <p><strong>{event.type === 'sighting' ? 'Sighting' : 'Check-in'}</strong></p>
                                <p>{formatJotformDate(event.timestampRaw)}</p>
                                <p>{event.location || 'Unknown location'}</p>
                                {event.type === 'sighting' && event.spottedWith?.length > 0 && (
                                    <p>With: {event.spottedWith.join(', ')}</p>
                                )}
                                {event.note && <p>{event.note}</p>}
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {routePositions.length >= 2 && (
                    <Polyline positions={routePositions} pathOptions={{ color: '#e74c3c', weight: 4, opacity: 0.7 }} />
                )}
            </MapContainer>
        </div>
    );
};

export default MapDashboard;
