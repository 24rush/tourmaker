export default class GPXProcessor {
    constructor() {
        this.elevation = 0.0;
        this.distance = 0.0;

        // Coordinates of bbox
        this._bbLeftBottom = {};
        this._bbTopRight = {};
        this._bbCenter = {};

        this.hasPoints = false;
        this.points = [];
        this.elevationPoints = [];
        this.minElevation = 0.0;
        this.maxElevation = 0.0;
    }

    distanceBetweenPoints(lat1, lon1, lat2, lon2) {
        var p = 0.017453292519943295;
        var c = Math.cos;
        var a =
            0.5 -
            c((lat2 - lat1) * p) / 2 +
            (c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))) / 2;

        return 12742 * Math.asin(Math.sqrt(a));
    }

    setPoints(points) {
        this.points = points;
        if (points.length == 0) return;

        let prevPoint = points[0];
        this._bbLeftBottom = { 'lat': prevPoint.lat, 'lng': prevPoint.lng };
        this._bbTopRight = { 'lat': prevPoint.lat, 'lng': prevPoint.lng };

        this.distance = 0.0
        this.elevation = 0
        this.elevationPoints = [];
        this.elevationPoints.push([0, prevPoint.alt]);

        let elevThreshold = points.length > 500 ? 3 : 0.5;
        this.minElevation = 99999;
        this.maxElevation = points[0].alt;

        for (var i = 1; i < points.length; i++) {
            let point = points[i];

            if (point.alt > prevPoint.alt) {
                this.elevation += point.alt - prevPoint.alt;
            }

            this.distance += this.distanceBetweenPoints(
                prevPoint.lat,
                prevPoint.lng,
                point.lat,
                point.lng
            );

            if (point.lat < this._bbLeftBottom.lat)
                this._bbLeftBottom.lat = point.lat;
            if (point.lng < this._bbLeftBottom.lng)
                this._bbLeftBottom.lng = point.lng;

            if (point.lat > this._bbTopRight.lat)
                this._bbTopRight.lat = point.lat;
            if (point.lng > this._bbTopRight.lng)
                this._bbTopRight.lng = point.lng;

            if (Math.abs(point.alt - prevPoint.alt) > elevThreshold)
                this.elevationPoints.push([this.distance, Math.floor(point.alt)]);

            if (point.alt < this.minElevation) this.minElevation = point.alt;
            if (point.alt > this.maxElevation) this.maxElevation = point.alt;

            prevPoint = point;
        }

        this.elevation = Math.floor(this.elevation);
        this.distance = Math.floor(this.distance);

        this._bbCenter.lat = (this._bbLeftBottom.lat + this._bbTopRight.lat) / 2;
        this._bbCenter.lng = (this._bbLeftBottom.lng + this._bbTopRight.lng) / 2;

        this.hasPoints = (points.length > 0);
    }

    getElevation() { return this.elevation }
    getDistance() { return this.distance; }
    getCenterPoint() { return this._bbCenter; }

    getElevationPoints() { return this.elevationPoints; }
    getElevationRange() { return Math.floor(this.maxElevation - this.minElevation); }
    getMaxAltitude() { return Math.floor(this.maxElevation); }
    getMinAltitude() { return Math.floor(this.minElevation); }
}