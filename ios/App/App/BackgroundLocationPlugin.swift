import Capacitor
import CoreLocation

@objc(BackgroundLocationPlugin)
public class BackgroundLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "BackgroundLocationPlugin"
    public let jsName = "BackgroundLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pause", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getLocations", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let locationManager = CLLocationManager()
    private var locations: [JSObject] = []
    private var lastRecordedAt: TimeInterval = 0
    private var pendingStartCallID: String?
    private var sessionActive = false
    private var updatesRunning = false

    override public func load() {
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.distanceFilter = 3
        locationManager.activityType = .fitness
        locationManager.pausesLocationUpdatesAutomatically = false
    }

    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            if self.sessionActive {
                self.startUpdates()
                call.resolve(["authorization": self.authorizationName])
                return
            }

            switch self.locationManager.authorizationStatus {
            case .notDetermined:
                self.bridge?.saveCall(call)
                self.pendingStartCallID = call.callbackId
                self.locationManager.requestAlwaysAuthorization()
            case .authorizedAlways, .authorizedWhenInUse:
                self.beginSession()
                call.resolve(["authorization": self.authorizationName])

                if self.locationManager.authorizationStatus == .authorizedWhenInUse {
                    self.locationManager.requestAlwaysAuthorization()
                }
            case .denied, .restricted:
                call.reject("위치 권한이 거부되었습니다.", "BACKGROUND_LOCATION_DENIED")
            @unknown default:
                call.reject("위치 권한 상태를 확인할 수 없습니다.", "BACKGROUND_LOCATION_UNKNOWN")
            }
        }
    }

    @objc func pause(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.locationManager.stopUpdatingLocation()
            self.updatesRunning = false
            call.resolve(["locations": self.locations])
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }

            guard self.sessionActive else {
                call.reject("진행 중인 러닝 위치 세션이 없습니다.", "BACKGROUND_LOCATION_INACTIVE")
                return
            }

            self.startUpdates()
            call.resolve(["authorization": self.authorizationName])
        }
    }

    @objc func getLocations(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            call.resolve(["locations": self?.locations ?? []])
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.locationManager.stopUpdatingLocation()
            self.updatesRunning = false
            self.sessionActive = false
            call.resolve(["locations": self.locations])
        }
    }

    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard
            let callID = pendingStartCallID,
            let call = bridge?.savedCall(withID: callID)
        else {
            return
        }

        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse:
            pendingStartCallID = nil
            beginSession()
            call.resolve(["authorization": authorizationName])
            bridge?.releaseCall(call)

            if manager.authorizationStatus == .authorizedWhenInUse {
                manager.requestAlwaysAuthorization()
            }
        case .denied, .restricted:
            pendingStartCallID = nil
            call.reject("위치 권한이 거부되었습니다.", "BACKGROUND_LOCATION_DENIED")
            bridge?.releaseCall(call)
        case .notDetermined:
            break
        @unknown default:
            pendingStartCallID = nil
            call.reject("위치 권한 상태를 확인할 수 없습니다.", "BACKGROUND_LOCATION_UNKNOWN")
            bridge?.releaseCall(call)
        }
    }

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations updates: [CLLocation]) {
        guard sessionActive && updatesRunning else { return }

        for location in updates where location.timestamp.timeIntervalSince1970 > lastRecordedAt {
            lastRecordedAt = location.timestamp.timeIntervalSince1970
            let payload = serialize(location)
            locations.append(payload)
            notifyListeners("location", data: payload)
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        notifyListeners("locationError", data: ["message": error.localizedDescription])
    }

    private func beginSession() {
        locations.removeAll(keepingCapacity: true)
        lastRecordedAt = 0
        sessionActive = true
        startUpdates()
    }

    private func startUpdates() {
        guard CLLocationManager.locationServicesEnabled() else { return }
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.showsBackgroundLocationIndicator = true
        locationManager.startUpdatingLocation()
        updatesRunning = true
    }

    private var authorizationName: String {
        switch locationManager.authorizationStatus {
        case .authorizedAlways:
            return "always"
        case .authorizedWhenInUse:
            return "whenInUse"
        case .denied, .restricted:
            return "denied"
        case .notDetermined:
            return "prompt"
        @unknown default:
            return "unknown"
        }
    }

    private func serialize(_ location: CLLocation) -> JSObject {
        return [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracy": location.horizontalAccuracy,
            "altitude": location.altitude,
            "speed": location.speed,
            "heading": location.course,
            "timestamp": location.timestamp.timeIntervalSince1970 * 1000
        ]
    }
}

class MyViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(BackgroundLocationPlugin())
    }
}
