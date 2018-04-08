/***
 * Copyright (C) 2018 Qli5. All Rights Reserved.
 * 
 * @author qli5 <goodlq11[at](163|gmail).com>
 * 
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/

import OnEventTarget from './on-event-target.js';

class MonitorStream extends TransformStream {
    constructor({
        onprogress = null,
        onabort = null,
        throttle = 0,
        loaded = 0,
        total = 0,
        lengthComputable = Boolean(total),
        progressInterval = 1000,
    } = {}) {
        let controller = null;
        let progressLast = 0;
        let last = 0;
        super({
            start: e => controller = e,

            transform: throttle ?
                async (chunk, controller) => {
                    const now = Date.now();
                    if (now - progressLast > this.progressInterval) {
                        this.dispatchEvent(this.getProgressEvent('progress'));
                        progressLast = now;
                    }
                    // drift = (expected chunk duration) - (actual chunk duration)
                    const drift = (1000 * chunk.length / this.throttle) - (now - last);
                    last = now;
                    if (drift > 0) await new Promise(resolve => setTimeout(resolve, 2 * drift));
                    this.loaded += chunk.length;
                    controller.enqueue(chunk);
                } :
                (chunk, controller) => {
                    const now = Date.now();
                    if (now - progressLast > this.progressInterval) {
                        this.dispatchEvent(this.getProgressEvent('progress'));
                        progressLast = now;
                    }
                    this.loaded += chunk.length;
                    controller.enqueue(chunk);
                },
        });

        OnEventTarget.mixin(this, ['progress', 'abort']);
        this.controller = controller;

        this.onprogress = onprogress;
        this.onabort = onabort;
        this.throttle = throttle;
        this.loaded = loaded;
        this.total = total;
        this.lengthComputable = lengthComputable;
        this.progressInterval = progressInterval;
    }

    abort() {
        this.dispatchEvent(this.getProgressEvent('abort'));
        return this.controller.error('AbortError');
    }

    getProgressEvent(type) {
        const event = new ProgressEvent(type, this);
        Object.defineProperty(event, 'target', {
            configurable: true,
            enumerable: true,
            get: () => this,
        })
        return event;
    }

    static _UNIT_TEST() {
        let reportLast = Date.now();
        let loadedLast = 0;

        let ms = new MonitorStream({
            throttle: 200 * 1024,
            onprogress: ({ loaded }) => {
                const now = Date.now();
                if (now - reportLast > 1000) {
                    console.log(`speed: ${((loaded - loadedLast) * 1.024 / (now - reportLast)).toPrecision(2)}KB/s`);
                    loadedLast = loaded;
                    reportLast = now;
                }
            },
        });
        (await fetch("https://upos-hz-mirrorcos.acgvideo.com/upgcxcode/98/01/29180198/29180198-1-32.flv?um_deadline=1523116413&platform=pc&rate=333200&oi=2310923265&um_sign=67328dff935cfe3e275f5dbcdb2bfbe1&gen=playurl&os=cos&trid=a1a7d25f9dd24100a86cbf8fbb1e5a3d")).body.pipeThrough(ms).pipeTo(new WritableStream());
    }
}

export default MonitorStream;
