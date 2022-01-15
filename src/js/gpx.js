
export default class GPXProcessor {
    constructor() {
        this.reset();
    }

    reset() {
        this.elevation = 0.0;
        this.distance = 0.0;

        // Coordinates of bbox
        this._bbLeftBottom = {};
        this._bbTopRight = {};
        this._bbCenter = {};

        this.points = [];
        this.kdtree = {};
        this.kdtreeprecision = 4;
        this.mergeThresholdMeters = 250;
        this.interpolationDistanceMeters = 10;
        this.elevationPoints = [];
        this.minElevation = 0.0;
        this.maxElevation = 0.0;
        this.gradientMaps = {};
    }

    trimToDigits(number, digits) {
        let divider = Math.pow(10, digits);
        return parseInt(number * divider) / divider;
    }

    addPointToKdTree(point, i) {
        let trimmedLng = this.trimToDigits(point.lng, this.kdtreeprecision);
        let trimmedLat = this.trimToDigits(point.lat, this.kdtreeprecision);

        if (!(trimmedLng in this.kdtree)) {
            this.kdtree[trimmedLng] = { [trimmedLat]: new Set([i]) };
        } else if (!(trimmedLat in this.kdtree[trimmedLng])) {
            this.kdtree[trimmedLng][trimmedLat] = new Set([i]);
        }
        else {
            this.kdtree[trimmedLng][trimmedLat].add(i);
        }
    }

    updateTreePoints() {
        let prevPoint = undefined;
        for (var i = 0; i < this.points.length; i++) {
            let point = this.points[i];

            if (i > 0) {
                let dist = GPXProcessor.distanceBetweenLatLngs(prevPoint.lat, prevPoint.lng, point.lat, point.lng) * 1000;
                let pointsNeeded = Math.floor((dist / this.interpolationDistanceMeters)) - 1;

                if (pointsNeeded > 0) {
                    let deltaLat = (point.lat - prevPoint.lat) / pointsNeeded;
                    let deltaLon = (point.lng - prevPoint.lng) / pointsNeeded;

                    for (let di = 1; di <= pointsNeeded; di++) {
                        this.addPointToKdTree({ lat: prevPoint.lat + (deltaLat * di), lng: prevPoint.lng + (deltaLon * di) }, i);
                    }
                }
            }

            this.addPointToKdTree(point, i);
            prevPoint = point;
        }

        //console.log(this.points);
        //console.log(this.kdtree);
    }

    getIndexOfPointInRoute(point) {
        let trimmedLng = this.trimToDigits(point.lng, this.kdtreeprecision);
        let trimmedLat = this.trimToDigits(point.lat, this.kdtreeprecision);

        if (trimmedLng in this.kdtree) {
            if (trimmedLat in this.kdtree[trimmedLng]) {
                return this.kdtree[trimmedLng][trimmedLat];
            }
        }

        return undefined;
    }

    getOverlapWithPoints(other_points) {
        var overlappingChains = [];

        for (let indexInOther = 0; indexInOther < other_points.length; indexInOther++) {
            let foundIndexSetInRoute = this.getIndexOfPointInRoute(other_points[indexInOther]);

            if (!foundIndexSetInRoute)
                continue;

            let foundAtLeastOneChain = false;
            let potentialNewChains = [];
            foundIndexSetInRoute.forEach(indexInRoute => {
                if (foundAtLeastOneChain)
                    return;

                foundAtLeastOneChain =
                    overlappingChains.find((chain, chainIndex) => {
                        if (indexInRoute == chain.indexInRoute + 1 && indexInOther == chain.endIndexInOther + 1) {
                            overlappingChains[chainIndex].indexInRoute = indexInRoute;
                            overlappingChains[chainIndex].endIndexInOther = indexInOther;
                            return true;
                        }
                    });

                if (!foundAtLeastOneChain) {
                    potentialNewChains.push({
                        'startIndexInOther': indexInOther,
                        'endIndexInOther': indexInOther,
                        'indexInRoute': indexInRoute
                    });
                }
            });

            if (!foundAtLeastOneChain) {
                overlappingChains = overlappingChains.concat(potentialNewChains);
            }

        }

        overlappingChains = overlappingChains.filter(chain => (chain.endIndexInOther - chain.startIndexInOther) > 0);

        let chainIndex = overlappingChains.length - 1;
        while (chainIndex > 0) {
            let chain = overlappingChains[chainIndex];

            let distanceFromLastChain = GPXProcessor.distanceBetweenPoints(other_points[overlappingChains[chainIndex - 1].endIndexInOther],
                other_points[chain.startIndexInOther]);

            if (distanceFromLastChain < this.mergeThresholdMeters) {
                overlappingChains[chainIndex - 1].endIndexInOther = chain.endIndexInOther;
                overlappingChains.splice(chainIndex, 1);
            }

            chainIndex--;
        };

        let pointsOverlapping = [];
        overlappingChains.forEach(chain => {
            let chainPoints = [];
            for (let si = chain.startIndexInOther; si <= chain.endIndexInOther; si++) {
                chainPoints.push(other_points[si]);
            }

            pointsOverlapping.push(chainPoints);
        });

        //console.log(overlappingChains);
        return pointsOverlapping;
    }

    static distanceBetweenPoints(p1, p2) {
        return GPXProcessor.distanceBetweenLatLngs(p1.lat,
            p1.lng,
            p2.lat,
            p2.lng)
    }

    static distanceBetweenLatLngs(lat1, lon1, lat2, lon2) { // KM
        var p = 0.017453292519943295;
        var c = Math.cos;
        var a =
            0.5 -
            c((lat2 - lat1) * p) / 2 +
            (c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))) / 2;

        return 12742 * Math.asin(Math.sqrt(a));
    }

    setPoints(points) {
        this.reset();
        if (points.length == 0) {
            return;
        }
        this.points = points;

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

        points[0].gradient = 0.0;
        points[points.length - 1].gradient = 0.0;
        points[0].distanceFromStart = 0.0;

        for (var i = 1; i < points.length; i++) {
            let point = points[i];

            if (point.alt > prevPoint.alt) {
                this.elevation += (point.alt - prevPoint.alt);
            }

            let distanceFromPrevious = GPXProcessor.distanceBetweenLatLngs(
                prevPoint.lat,
                prevPoint.lng,
                point.lat,
                point.lng
            );
            this.distance += distanceFromPrevious;

            point.distanceFromStart = this.distance;
            points[i - 1].gradient = distanceFromPrevious != 0 ? ((point.alt - prevPoint.alt) / (1000 * distanceFromPrevious)) * 100 : 0.0;
            this.addGradientToMap(points[i - 1].gradient, distanceFromPrevious);

            if (point.lat < this._bbLeftBottom.lat)
                this._bbLeftBottom.lat = point.lat;
            if (point.lng < this._bbLeftBottom.lng)
                this._bbLeftBottom.lng = point.lng;

            if (point.lat > this._bbTopRight.lat)
                this._bbTopRight.lat = point.lat;
            if (point.lng > this._bbTopRight.lng)
                this._bbTopRight.lng = point.lng;

            if (Math.abs(prevPoint.alt - point.alt) > elevThreshold)
                this.elevationPoints.push([this.distance, Math.floor(point.alt)]);

            if (point.alt < this.minElevation) this.minElevation = point.alt;
            if (point.alt > this.maxElevation) this.maxElevation = point.alt;

            prevPoint = point;
        }

        this.elevation = Math.floor(this.elevation);
        this.distance = Math.floor(this.distance);

        this._bbCenter.lat = (this._bbLeftBottom.lat + this._bbTopRight.lat) / 2;
        this._bbCenter.lng = (this._bbLeftBottom.lng + this._bbTopRight.lng) / 2;

        this.updateTreePoints();
    }

    getElevation() { return this.elevation }
    getDistance() { return this.distance; }
    getCenterPoint() { return this._bbCenter; }

    getElevationPoints() { return this.elevationPoints; }
    getElevationRange() { return Math.floor(this.maxElevation - this.minElevation); }
    getMaxAltitude() { return Math.floor(this.maxElevation); }
    getMinAltitude() { return Math.floor(this.minElevation); }

    getPointAtDistanceFromStart(distance) {
        for (var i = 1; i < this.points.length; i++) {
            let point = this.points[i];

            if (point.distanceFromStart >= distance) {
                return this.points[i - 1];
            }
        }
        return undefined;
    }

    getLatLongAtDistanceFromStart(distanceFromStart) {
        let point = this.getPointAtDistanceFromStart(distanceFromStart);
        if (!point) return undefined;

        return point;
    }

    getGradientAtDistanceFromStart(distanceFromStart) {
        let point = this.getPointAtDistanceFromStart(distanceFromStart);
        if (!point) return undefined;

        return point.gradient;
    }

    getLatLongAtIndexPosition(index) {
        if (index < 0 || index > this.points.length) return undefined;
        return this.points[index];
    }

    getGradientAtIndexPosition(index) {
        if (index < 0 || index > this.points.length) return 0.0;
        return this.points[index].gradient;
    }

    addGradientToMap(gradient, distance) {
        gradient = gradient > 0 ? Math.floor(gradient) : Math.ceil(gradient);
        if (gradient in this.gradientMaps)
            this.gradientMaps[gradient] += distance;
        else
            this.gradientMaps[gradient] = distance;
    }

    getDistanceInGradientRange(rangeMin, rangeMax) {
        let totalDistance = 0.0;
        for (let gradient = Math.floor(rangeMin); gradient <= Math.floor(rangeMax); gradient++) {
            if (!(gradient in this.gradientMaps))
                continue;

            totalDistance += this.gradientMaps[gradient];
        }

        return Math.floor(totalDistance);
    }
}