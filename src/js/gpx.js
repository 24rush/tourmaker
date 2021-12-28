export default class GPXProcessor {
    constructor() {
        this.elevation = 0.0;
        this.distance = 0.0;
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

            prevPoint = point;
        }

        this.elevation = Math.floor(this.elevation);
        this.distance = Math.floor(this.distance);

        console.log(this.elevation);
        console.log(this.distance);
    }

    getElevation() {
        return this.elevation
    }

    getDistance() {
        return this.distance;
    }
}