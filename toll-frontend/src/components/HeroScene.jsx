export default function HeroScene() {
  return (
    <div className="hs-scene" aria-label="Animation: a vehicle passes the toll gate without stopping">
      <div className="hs-road">
        <div className="hs-dashes" />
      </div>

      <div className="hs-gate">
        <div className="hs-chip">✓ TOLL PAID · ZMW 25.00</div>
        <div className="hs-roof">TOLLPAY GATE</div>
        <div className="hs-post hs-post-l" />
        <div className="hs-post hs-post-r" />
        <div className="hs-barrier" />
        <div className="hs-scan" />
      </div>

      <div className="hs-car">🚗</div>
    </div>
  );
}