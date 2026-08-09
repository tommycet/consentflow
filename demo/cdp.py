"""Minimal Chrome DevTools Protocol driver for the ConsentFlow demo recording.

Drives a Chromium instance running on Xvfb via raw CDP over websocket.
No Playwright, no ffmpeg — Cap.so handles capture and export.
"""
import json
import time
import urllib.request

import websocket


class CDP:
    def __init__(self, port=9222):
        targets = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list"))
        page = next(t for t in targets if t["type"] == "page")
        self.ws = websocket.create_connection(
            page["webSocketDebuggerUrl"], timeout=30, suppress_origin=True
        )
        self._id = 0
        self.send("Page.enable")
        self.send("Runtime.enable")

    def send(self, method, **params):
        self._id += 1
        self.ws.send(json.dumps({"id": self._id, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self._id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    def eval(self, expr, await_promise=False):
        r = self.send(
            "Runtime.evaluate",
            expression=expr,
            returnByValue=True,
            awaitPromise=await_promise,
        )
        return r.get("result", {}).get("value")

    def goto(self, url, settle=2.0):
        """SPA-friendly navigation via history.pushState + popstate."""
        self.send("Page.navigate", url=url)
        self.send("Page.bringToFront")
        time.sleep(settle)

    def smooth_scroll(self, target_y, duration, steps=None):
        """Scroll to target_y over `duration` seconds with eased steps."""
        start = self.eval("window.scrollY") or 0
        steps = steps or max(int(duration * 25), 1)
        for i in range(1, steps + 1):
            t = i / steps
            eased = t * t * (3 - 2 * t)  # smoothstep
            y = start + (target_y - start) * eased
            self.eval(f"window.scrollTo(0,{y:.0f})")
            time.sleep(duration / steps)

    def scroll_to_selector(self, selector, duration):
        y = self.eval(
            "(()=>{const e=document.querySelector(%s);"
            "return e?window.scrollY+e.getBoundingClientRect().top-90:null})()" % json.dumps(selector)
        )
        if y is None:
            return False
        self.smooth_scroll(y, duration)
        return True

    def click_text(self, text, tag="button"):
        """Click the first element whose text contains `text` (real MouseEvent)."""
        ok = self.eval(
            "(()=>{const els=[...document.querySelectorAll(%s)];"
            "const el=els.find(e=>e.innerText.trim().includes(%s));"
            "if(!el)return false; el.scrollIntoView({block:'center'});"
            "el.click(); return true})()" % (json.dumps(tag), json.dumps(text))
        )
        return bool(ok)

    def type_into(self, selector, value, per_char=0.05):
        """Type into a React-controlled input using the native value setter."""
        self.eval(
            "(()=>{const e=document.querySelector(%s);"
            "if(e){e.scrollIntoView({block:'center'});e.focus();}})()" % json.dumps(selector)
        )
        typed = ""
        for ch in str(value):
            typed += ch
            self.eval(
                "(()=>{const e=document.querySelector(%s);if(!e)return;"
                "const d=Object.getOwnPropertyDescriptor(e.constructor.prototype,'value');"
                "d.set.call(e,%s);e.dispatchEvent(new Event('input',{bubbles:true}));})()"
                % (json.dumps(selector), json.dumps(typed))
            )
            time.sleep(per_char)
        return self.eval(
            "(()=>{const e=document.querySelector(%s);return e?e.value:null})()" % json.dumps(selector)
        )

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass
