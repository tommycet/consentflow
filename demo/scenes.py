"""ConsentFlow demo scene driver.

Timings are locked to the edge-tts narration clip durations so every on-screen
transition lands on the matching sentence. Durations (seconds), measured with
ffprobe:

  01_hero        17.256   landing hero
  02_arch        17.856   architecture diagram
  03_evidence    14.736   stats + contracts + security
  04_participant 13.584   participant page, showcase wallet connect
  05_consent     17.544   study id / purpose + create on-chain
  06_researcher  16.680   researcher queue access request
  07_audit       14.712   audit trail + filters
  08_docs        17.136   docs sidebar walk

Total ~129.5s. Each scene function must consume its full budget.
"""
import time

from cdp import CDP

BASE = "http://127.0.0.1:5173"
D = {
    "hero": 17.256,
    "arch": 17.856,
    "evidence": 14.736,
    "participant": 13.584,
    "consent": 17.544,
    "researcher": 16.680,
    "audit": 14.712,
    "docs": 17.136,
}


def log(scene, t0):
    print(f"[{time.time() - t0:7.2f}s] {scene}", flush=True)


# Cumulative narration boundaries — each scene must end exactly here.
CUM = {}
_acc = 0.0
for _k in ("hero", "arch", "evidence", "participant", "consent", "researcher", "audit", "docs"):
    _acc += D[_k]
    CUM[_k] = _acc


def pace(c, t0, key):
    """Hold on the current view until the narration clip for `key` is over."""
    remaining = CUM[key] - (time.time() - t0)
    if remaining > 0:
        # Drift the view slightly so the frame is never frozen.
        steps = max(int(remaining * 10), 1)
        y0 = c.eval("window.scrollY") or 0
        for i in range(steps):
            c.eval(f"window.scrollTo(0,{y0 + i * 0.6:.0f})")
            time.sleep(remaining / steps)
    else:
        print(f"   OVER BUDGET {key} by {-remaining:.2f}s", flush=True)


def scene_hero(c, t0):
    log("01 hero", t0)
    c.goto(BASE + "/", settle=1.0)
    c.eval("window.scrollTo(0,0)")
    time.sleep(max(D["hero"] - 1.0 - 5.0, 0.5))
    c.smooth_scroll(420, 4.0)
    pace(c, t0, "hero")


def scene_arch(c, t0):
    log("02 architecture", t0)
    c.scroll_to_selector(".cf-architecture", 1.8)
    time.sleep(6.0)
    c.scroll_to_selector(".cf-flow", 2.5)
    pace(c, t0, "arch")


def scene_evidence(c, t0):
    log("03 evidence", t0)
    c.scroll_to_selector(".cf-rail-list", 3.0)
    time.sleep(2.0)
    c.scroll_to_selector(".cf-contracts", 3.0)
    time.sleep(2.0)
    c.scroll_to_selector(".cf-security", 3.0)
    pace(c, t0, "evidence")


def scene_participant(c, t0):
    log("04 participant + showcase wallet", t0)
    c.goto(BASE + "/participant", settle=1.5)
    time.sleep(0.8)
    ok = c.click_text("Use Showcase Wallet")
    print("   showcase wallet clicked:", ok, flush=True)
    time.sleep(3.0)
    print("   signer live:", c.eval("!!window.__wallet"), flush=True)
    c.smooth_scroll(260, 2.5)
    pace(c, t0, "participant")


def scene_consent(c, t0):
    log("05 create consent", t0)
    inputs = "input[type=text]"
    n = c.eval(f"document.querySelectorAll('{inputs}').length")
    print("   text inputs:", n, flush=True)
    c.scroll_to_selector(".cf-panel", 2.0)
    v1 = c.type_into(f"{inputs}:nth-of-type(1)", "NCT-04891965", per_char=0.07)
    time.sleep(0.8)
    v2 = c.eval(
        "(()=>{const e=[...document.querySelectorAll('input[type=text]')][1];"
        "return e?e.value:null})()"
    )
    print("   study id:", v1, "| purpose before:", v2, flush=True)
    # second input: purpose
    c.eval(
        "(()=>{const e=[...document.querySelectorAll('input[type=text]')][1];"
        "if(e){e.scrollIntoView({block:'center'});e.focus();}})()"
    )
    typed = ""
    for ch in "Cardio-metabolic biomarker analysis":
        typed += ch
        c.eval(
            "(()=>{const e=[...document.querySelectorAll('input[type=text]')][1];if(!e)return;"
            "const d=Object.getOwnPropertyDescriptor(e.constructor.prototype,'value');"
            "d.set.call(e,%r);e.dispatchEvent(new Event('input',{bubbles:true}));})()" % typed
        )
        time.sleep(0.05)
    print("   purpose:", c.eval(
        "(()=>{const e=[...document.querySelectorAll('input[type=text]')][1];return e?e.value:null})()"
    ), flush=True)
    time.sleep(1.0)
    print("   create clicked:", c.click_text("Create On-Chain"), flush=True)
    pace(c, t0, "consent")


def scene_researcher(c, t0):
    log("06 researcher", t0)
    c.goto(BASE + "/researcher", settle=1.5)
    time.sleep(0.8)
    print("   showcase wallet clicked:", c.click_text("Use Showcase Wallet"), flush=True)
    time.sleep(2.5)
    nums = c.eval("document.querySelectorAll('input[type=number]').length")
    print("   number inputs:", nums, flush=True)
    c.type_into("input[type=number]", "1", per_char=0.2)
    time.sleep(0.5)
    c.type_into("input[type=text]", "0.001", per_char=0.12)
    time.sleep(1.0)
    print("   queue clicked:", c.click_text("Queue On-Chain"), flush=True)
    pace(c, t0, "researcher")


def scene_audit(c, t0):
    log("07 audit", t0)
    c.goto(BASE + "/audit", settle=1.5)
    time.sleep(1.5)
    for label in ("Consents", "Requests", "All Events"):
        print("   filter", label, c.click_text(label), flush=True)
        time.sleep(2.5)
    pace(c, t0, "audit")


def scene_docs(c, t0):
    log("08 docs", t0)
    c.goto(BASE + "/docs", settle=2.0)
    time.sleep(1.5)
    for label in ("Smart contracts", "Backend API", "Cleanverse rails", "Security"):
        print("   section", label, c.click_text(label), flush=True)
        time.sleep(3.2)
    pace(c, t0, "docs")


def main():
    c = CDP()
    t0 = time.time()
    for fn in (
        scene_hero,
        scene_arch,
        scene_evidence,
        scene_participant,
        scene_consent,
        scene_researcher,
        scene_audit,
        scene_docs,
    ):
        fn(c, t0)
    print(f"TOTAL {time.time() - t0:.2f}s", flush=True)
    c.close()


if __name__ == "__main__":
    main()
