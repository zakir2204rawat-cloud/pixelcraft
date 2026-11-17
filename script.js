// =========================================
// PIXELCRAFT - DIGITAL DRAWING STUDIO
// =========================================

// 1. SELECT HTML ELEMENTS

const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const brushSize = document.getElementById("brushSize");
const sizeValue = document.getElementById("sizeValue");
const opacitySlider = document.getElementById("opacity");
const opacityValue = document.getElementById("opacityValue");
const brushDot = document.getElementById("brushDot");
const fillShapes = document.getElementById("fillShapes");

const toolButtons = document.querySelectorAll(".tool");

const wheel = document.getElementById("colorWheel");
const wheelCtx = wheel.getContext("2d");
const brightness = document.getElementById("brightness");
const brightnessValue = document.getElementById("brightnessValue");
const hexInput = document.getElementById("hexInput");
const colorPreview = document.getElementById("colorPreview");
const saveColorButton = document.getElementById("saveColorButton");
const clearMyColours = document.getElementById("clearMyColours");
const myColoursBox = document.getElementById("myColours");
const paletteBox = document.getElementById("palette");

const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");
const clearButton = document.getElementById("clearButton");
const downloadButton = document.getElementById("downloadButton");

const status = document.getElementById("status");


// 2. DRAWING VARIABLES

const toolNames = {
    brush: "Brush", pencil: "Pencil", marker: "Marker", spray: "Spray",
    eraser: "Eraser", fill: "Fill", picker: "Colour picker",
    line: "Line", arrow: "Arrow", rect: "Rectangle", ellipse: "Circle",
    triangle: "Triangle", star: "Star", heart: "Heart"
};

const freehandTools = ["brush", "pencil", "marker", "eraser"];
const shapeTools = ["line", "arrow", "rect", "ellipse", "triangle", "star", "heart"];

let drawing = false;
let currentTool = "brush";
let toolBeforePicker = "brush";
let currentColor = "#4f6bff";
let currentSize = 8;
let currentOpacity = 1;

let startX = 0;
let startY = 0;
let lastPos = { x: 0, y: 0 };
let points = [];
let sprayTimer = null;

let savedImage = null;
let history = [];
let redoStack = [];

// Colour wheel state: hue 0-360, saturation 0-1, value (brightness) 0-1
let hsv = { h: 226, s: 0.69, v: 1 };


// 3. PREPARE THE CANVAS

function prepareCanvas() {

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    saveHistory();

}

prepareCanvas();


// 4. GET THE CORRECT MOUSE OR TOUCH POSITION

function getPosition(event) {

    const rect = canvas.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };

}


// 5. HISTORY (UNDO / REDO)

function saveHistory() {

    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    redoStack = [];

    // Keep only the latest 30 snapshots.
    if (history.length > 30) {
        history.shift();
    }

}

undoButton.addEventListener("click", undo);
redoButton.addEventListener("click", redo);

function undo() {

    if (drawing) return;

    if (history.length <= 1) {
        status.textContent = "Nothing to undo";
        return;
    }

    redoStack.push(history.pop());

    ctx.putImageData(history[history.length - 1], 0, 0);

    status.textContent = "Last action undone";

}

function redo() {

    if (drawing) return;

    if (redoStack.length === 0) {
        status.textContent = "Nothing to redo";
        return;
    }

    const next = redoStack.pop();

    history.push(next);

    ctx.putImageData(next, 0, 0);

    status.textContent = "Action restored";

}

document.addEventListener("keydown", event => {

    if (event.target === hexInput) return;

    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;

    if (ctrl && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
    } else if (ctrl && (key === "y" || (key === "z" && event.shiftKey))) {
        event.preventDefault();
        redo();
    }

});


// 6. COLOUR HELPERS

function hsvToRgb(h, s, v) {

    const c = v * s;
    const hh = (h % 360) / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r = 0, g = 0, b = 0;

    if (hh < 1)      { r = c; g = x; }
    else if (hh < 2) { r = x; g = c; }
    else if (hh < 3) { g = c; b = x; }
    else if (hh < 4) { g = x; b = c; }
    else if (hh < 5) { r = x; b = c; }
    else             { r = c; b = x; }

    const m = v - c;

    return [r + m, g + m, b + m].map(n => Math.round(n * 255));

}

function rgbToHsv(r, g, b) {

    r /= 255; g /= 255; b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;

    if (d !== 0) {
        if (max === r)      h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
    }

    return { h: h, s: max === 0 ? 0 : d / max, v: max };

}

function rgbToHex(r, g, b) {
    return "#" + [r, g, b].map(n => n.toString(16).padStart(2, "0")).join("");
}

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function normaliseHex(text) {

    let value = text.trim().replace(/^#/, "");

    if (/^[0-9a-f]{3}$/i.test(value)) {
        value = value.split("").map(c => c + c).join("");
    }

    return /^[0-9a-f]{6}$/i.test(value) ? "#" + value.toLowerCase() : null;

}


// 7. COLOUR WHEEL

function drawWheel() {

    const size = wheel.width;
    const radius = size / 2;
    const image = wheelCtx.createImageData(size, size);

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {

            const dx = x - radius + 0.5;
            const dy = y - radius + 0.5;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const i = (y * size + x) * 4;

            if (dist <= radius) {

                const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
                const rgb = hsvToRgb(hue, dist / radius, hsv.v);

                image.data[i] = rgb[0];
                image.data[i + 1] = rgb[1];
                image.data[i + 2] = rgb[2];
                image.data[i + 3] = dist > radius - 1 ? 255 * (radius - dist) : 255;

            }

        }
    }

    wheelCtx.putImageData(image, 0, 0);

    // Draw the selector ring
    const angle = hsv.h * Math.PI / 180;
    const hx = radius + Math.cos(angle) * hsv.s * radius;
    const hy = radius + Math.sin(angle) * hsv.s * radius;

    wheelCtx.beginPath();
    wheelCtx.arc(hx, hy, 11, 0, Math.PI * 2);
    wheelCtx.fillStyle = currentColor;
    wheelCtx.fill();
    wheelCtx.lineWidth = 4;
    wheelCtx.strokeStyle = "#ffffff";
    wheelCtx.stroke();
    wheelCtx.lineWidth = 1.5;
    wheelCtx.strokeStyle = "rgba(0,0,0,.55)";
    wheelCtx.beginPath();
    wheelCtx.arc(hx, hy, 13, 0, Math.PI * 2);
    wheelCtx.stroke();

}

function updateColourUI() {

    const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);

    currentColor = rgbToHex(rgb[0], rgb[1], rgb[2]);

    colorPreview.style.background = currentColor;

    if (document.activeElement !== hexInput) {
        hexInput.value = currentColor.toUpperCase();
    }

    brightness.value = Math.round(hsv.v * 100);
    brightnessValue.textContent = Math.round(hsv.v * 100);

    drawWheel();
    updateBrushPreview();
    highlightSwatches();

}

// Called whenever the user picks a colour from anywhere
function chooseColour(hex, message) {

    const rgb = hexToRgb(hex);
    const next = rgbToHsv(rgb[0], rgb[1], rgb[2]);

    // Keep the hue when the colour is grey/black so the wheel doesn't jump
    if (next.s === 0 || next.v === 0) {
        next.h = hsv.h;
    }

    hsv = next;

    if (currentTool === "eraser") {
        selectTool("brush");
    }

    updateColourUI();

    status.textContent = message || "Colour selected";

}

function setFromWheel(event) {

    const rect = wheel.getBoundingClientRect();
    const radius = rect.width / 2;

    const dx = event.clientX - rect.left - radius;
    const dy = event.clientY - rect.top - radius;

    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), radius);

    hsv.h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    hsv.s = dist / radius;

    if (currentTool === "eraser") {
        selectTool("brush");
    }

    updateColourUI();

    status.textContent = "Mixing a colour";

}

let wheelActive = false;

wheel.addEventListener("pointerdown", event => {
    wheelActive = true;
    try { wheel.setPointerCapture(event.pointerId); } catch (error) {}
    setFromWheel(event);
});

wheel.addEventListener("pointermove", event => {
    if (wheelActive) setFromWheel(event);
});

wheel.addEventListener("pointerup", () => { wheelActive = false; });
wheel.addEventListener("pointercancel", () => { wheelActive = false; });

brightness.addEventListener("input", () => {

    hsv.v = Number(brightness.value) / 100;

    if (currentTool === "eraser") {
        selectTool("brush");
    }

    updateColourUI();

    status.textContent = "Brightness changed";

});

hexInput.addEventListener("input", () => {

    const hex = normaliseHex(hexInput.value);

    if (hex) {
        chooseColour(hex);
    }

});

hexInput.addEventListener("blur", () => {
    hexInput.value = currentColor.toUpperCase();
});


// 8. QUICK COLOUR PALETTE

const quickColours = [
    // neutrals
    "#000000", "#3a3a3c", "#6e6e73", "#a1a1a6", "#d1d1d6", "#ffffff",
    // reds, oranges, yellows
    "#7f1d1d", "#dc2626", "#ff3b30", "#fb7185", "#f97316", "#ff9500",
    "#fbbf24", "#ffcc00",
    // greens
    "#14532d", "#16a34a", "#34c759", "#86efac", "#0d9488", "#2dd4bf",
    // blues
    "#1e3a8a", "#2855d9", "#007aff", "#38bdf8", "#5ac8fa", "#06b6d4",
    // purples and pinks
    "#581c87", "#8b5cf6", "#af52de", "#d946ef", "#ff2d92", "#f9a8d4",
    // browns and skin tones
    "#78350f", "#92400e", "#a16207", "#c08457", "#f5d0a9", "#fde68a"
];

function makeSwatch(color) {

    const button = document.createElement("button");

    button.type = "button";
    button.className = "swatch";
    button.dataset.color = color;
    button.style.background = color;
    button.title = color.toUpperCase();
    button.setAttribute("aria-label", color);

    button.addEventListener("click", () => chooseColour(color));

    return button;

}

quickColours.forEach(color => paletteBox.appendChild(makeSwatch(color)));

function highlightSwatches() {

    document.querySelectorAll(".swatch").forEach(swatch => {
        swatch.classList.toggle("selected", swatch.dataset.color === currentColor);
    });

}


// 9. MY COLOURS (saved custom colours)

let myColours = [];

try {
    const stored = JSON.parse(localStorage.getItem("pixelcraft-my-colours"));
    if (Array.isArray(stored)) {
        myColours = stored.filter(c => normaliseHex(String(c)));
    }
} catch (error) {
    myColours = [];
}

function persistMyColours() {
    try {
        localStorage.setItem("pixelcraft-my-colours", JSON.stringify(myColours));
    } catch (error) {
        // Storage can be blocked; colours still work for this visit.
    }
}

function renderMyColours() {

    myColoursBox.innerHTML = "";

    if (myColours.length === 0) {

        const note = document.createElement("span");

        note.className = "empty-note";
        note.textContent = "Colours you save will appear here.";

        myColoursBox.appendChild(note);

    } else {

        myColours.forEach(color => myColoursBox.appendChild(makeSwatch(color)));

    }

    clearMyColours.style.display = myColours.length ? "" : "none";

    highlightSwatches();

}

saveColorButton.addEventListener("click", () => {

    if (myColours.includes(currentColor)) {
        status.textContent = "Colour already saved";
        return;
    }

    myColours.unshift(currentColor);
    myColours = myColours.slice(0, 24);

    persistMyColours();
    renderMyColours();

    status.textContent = "Colour saved to My Colours";

});

clearMyColours.addEventListener("click", () => {

    myColours = [];

    persistMyColours();
    renderMyColours();

    status.textContent = "My Colours cleared";

});

renderMyColours();


// 10. BRUSH SIZE, OPACITY & PREVIEW

function updateBrushPreview() {

    const factor = { pencil: 0.35, marker: 1.8, spray: 2.5, eraser: 1.5 }[currentTool] || 1;
    const size = Math.max(2, Math.min(64, currentSize * factor));

    brushDot.style.width = size + "px";
    brushDot.style.height = size + "px";
    brushDot.style.background = currentTool === "eraser" ? "#cfd5e3" : currentColor;
    brushDot.style.opacity = currentTool === "marker" ? currentOpacity * 0.4 : currentOpacity;

}

brushSize.addEventListener("input", () => {

    currentSize = Number(brushSize.value);

    sizeValue.textContent = currentSize;

    updateBrushPreview();

});

opacitySlider.addEventListener("input", () => {

    currentOpacity = Number(opacitySlider.value) / 100;

    opacityValue.textContent = opacitySlider.value;

    updateBrushPreview();

});


// 11. CHANGE DRAWING TOOL

function selectTool(tool) {

    if (tool === "picker" && currentTool !== "picker") {
        toolBeforePicker = currentTool;
    }

    currentTool = tool;

    toolButtons.forEach(button => {
        button.classList.toggle("active", button.dataset.tool === tool);
    });

    updateBrushPreview();

    status.textContent = toolNames[tool] + " selected";

}

toolButtons.forEach(button => {

    button.addEventListener("click", () => {
        selectTool(button.dataset.tool);
    });

});


// 12. DRAWING HELPERS

function strokeStyleFor(tool) {

    switch (tool) {
        case "pencil":
            return { color: currentColor, width: Math.max(1, currentSize * 0.35), alpha: currentOpacity };
        case "marker":
            return { color: currentColor, width: currentSize * 1.8, alpha: currentOpacity * 0.4 };
        case "eraser":
            return { color: "#ffffff", width: currentSize * 1.5, alpha: 1 };
        default:
            return { color: currentColor, width: currentSize, alpha: currentOpacity };
    }

}

// Draws one smooth stroke through all the points collected so far
function strokePoints(list, style) {

    const pts = list.length === 1
        ? [list[0], { x: list[0].x + 0.01, y: list[0].y + 0.01 }]
        : list;

    ctx.save();

    ctx.globalAlpha = style.alpha;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }

    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();

    ctx.restore();

}

function renderFreehand() {

    ctx.putImageData(savedImage, 0, 0);

    strokePoints(points, strokeStyleFor(currentTool));

}

function sprayAt(pos) {

    const radius = currentSize * 2.5 + 4;
    const dots = Math.round(currentSize * 2 + 10);

    ctx.save();

    ctx.fillStyle = currentColor;
    ctx.globalAlpha = Math.min(1, currentOpacity * 0.7);

    for (let i = 0; i < dots; i++) {

        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * radius;

        ctx.fillRect(
            pos.x + Math.cos(angle) * dist,
            pos.y + Math.sin(angle) * dist,
            1.8,
            1.8
        );

    }

    ctx.restore();

}

function renderShape(tool, x0, y0, x1, y1) {

    const w = x1 - x0;
    const h = y1 - y0;
    const cx = x0 + w / 2;
    const cy = y0 + h / 2;
    const filled = fillShapes.checked && tool !== "line" && tool !== "arrow";

    ctx.save();

    ctx.globalAlpha = currentOpacity;
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();

    switch (tool) {

        case "line":
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            break;

        case "arrow": {
            const angle = Math.atan2(y1 - y0, x1 - x0);
            const head = Math.max(14, currentSize * 3.5);
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.moveTo(x1 - head * Math.cos(angle - Math.PI / 6),
                       y1 - head * Math.sin(angle - Math.PI / 6));
            ctx.lineTo(x1, y1);
            ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 6),
                       y1 - head * Math.sin(angle + Math.PI / 6));
            break;
        }

        case "rect":
            ctx.rect(x0, y0, w, h);
            break;

        case "ellipse":
            ctx.ellipse(cx, cy, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
            break;

        case "triangle":
            ctx.moveTo(x0 + w / 2, y0);
            ctx.lineTo(x0 + w, y0 + h);
            ctx.lineTo(x0, y0 + h);
            ctx.closePath();
            break;

        case "star": {
            const rx = Math.abs(w) / 2;
            const ry = Math.abs(h) / 2;
            for (let i = 0; i < 10; i++) {
                const r = i % 2 === 0 ? 1 : 0.4;
                const a = -Math.PI / 2 + i * Math.PI / 5;
                const px = cx + Math.cos(a) * rx * r;
                const py = cy + Math.sin(a) * ry * r;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            break;
        }

        case "heart":
            ctx.moveTo(cx, y0 + h * 0.3);
            ctx.bezierCurveTo(cx, y0, x0, y0, x0, y0 + h * 0.3);
            ctx.bezierCurveTo(x0, y0 + h * 0.6, cx, y0 + h * 0.75, cx, y0 + h);
            ctx.bezierCurveTo(cx, y0 + h * 0.75, x0 + w, y0 + h * 0.6, x0 + w, y0 + h * 0.3);
            ctx.bezierCurveTo(x0 + w, y0, cx, y0, cx, y0 + h * 0.3);
            ctx.closePath();
            break;

    }

    if (filled) {
        ctx.fill();
    } else {
        ctx.stroke();
    }

    ctx.restore();

}


// 13. FILL BUCKET

function floodFill(startPosX, startPosY, hex) {

    const w = canvas.width;
    const h = canvas.height;

    const image = ctx.getImageData(0, 0, w, h);
    const d = image.data;

    const sx = Math.max(0, Math.min(w - 1, Math.floor(startPosX)));
    const sy = Math.max(0, Math.min(h - 1, Math.floor(startPosY)));

    const startIndex = (sy * w + sx) * 4;
    const tr = d[startIndex];
    const tg = d[startIndex + 1];
    const tb = d[startIndex + 2];

    const fill = hexToRgb(hex);
    const a = currentOpacity;

    const nr = Math.round(tr * (1 - a) + fill[0] * a);
    const ng = Math.round(tg * (1 - a) + fill[1] * a);
    const nb = Math.round(tb * (1 - a) + fill[2] * a);

    if (nr === tr && ng === tg && nb === tb) return false;

    const tolerance = 48;
    const visited = new Uint8Array(w * h);
    const stack = [sy * w + sx];

    while (stack.length) {

        const p = stack.pop();

        if (visited[p]) continue;
        visited[p] = 1;

        const i = p * 4;

        if (Math.abs(d[i] - tr) > tolerance ||
            Math.abs(d[i + 1] - tg) > tolerance ||
            Math.abs(d[i + 2] - tb) > tolerance) {
            continue;
        }

        d[i] = nr;
        d[i + 1] = ng;
        d[i + 2] = nb;
        d[i + 3] = 255;

        const x = p % w;

        if (x > 0) stack.push(p - 1);
        if (x < w - 1) stack.push(p + 1);
        if (p >= w) stack.push(p - w);
        if (p < w * (h - 1)) stack.push(p + w);

    }

    ctx.putImageData(image, 0, 0);

    return true;

}


// 14. COLOUR PICKER (EYEDROPPER)

function pickColourAt(pos) {

    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(pos.x)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(pos.y)));

    const pixel = ctx.getImageData(x, y, 1, 1).data;

    selectTool(toolBeforePicker || "brush");

    chooseColour(rgbToHex(pixel[0], pixel[1], pixel[2]), "Colour picked");

}


// 15. START DRAWING

function startDrawing(event) {

    if (event.button !== undefined && event.button !== 0) {
        return;
    }

    event.preventDefault();

    const position = getPosition(event);

    if (currentTool === "picker") {
        pickColourAt(position);
        return;
    }

    if (currentTool === "fill") {

        if (floodFill(position.x, position.y, currentColor)) {
            saveHistory();
            status.textContent = "Area filled";
        } else {
            status.textContent = "Already that colour";
        }

        return;

    }

    drawing = true;

    try { canvas.setPointerCapture(event.pointerId); } catch (error) {}

    startX = position.x;
    startY = position.y;
    lastPos = position;
    points = [position];

    savedImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

    if (currentTool === "spray") {

        sprayAt(position);

        // Keep spraying while the pointer is held still
        sprayTimer = setInterval(() => sprayAt(lastPos), 35);

    } else if (freehandTools.includes(currentTool)) {

        renderFreehand();

    }

    status.textContent = "Drawing...";

}


// 16. DRAW WHILE MOVING

function draw(event) {

    if (!drawing) return;

    event.preventDefault();

    const position = getPosition(event);

    lastPos = position;

    if (currentTool === "spray") {

        sprayAt(position);

    } else if (freehandTools.includes(currentTool)) {

        points.push(position);

        renderFreehand();

    } else if (shapeTools.includes(currentTool)) {

        ctx.putImageData(savedImage, 0, 0);

        renderShape(currentTool, startX, startY, position.x, position.y);

    }

}


// 17. STOP DRAWING

function stopDrawing() {

    if (!drawing) return;

    drawing = false;

    clearInterval(sprayTimer);
    sprayTimer = null;

    ctx.beginPath();

    saveHistory();

    status.textContent = "Ready to create";

}


// 18. POINTER EVENTS (mouse, touch and stylus)

canvas.addEventListener("pointerdown", startDrawing);

canvas.addEventListener("pointermove", draw);

window.addEventListener("pointerup", stopDrawing);

window.addEventListener("pointercancel", stopDrawing);


// 19. CLEAR THE CANVAS

clearButton.addEventListener("click", () => {

    if (drawing) return;

    const confirmed = confirm("Are you sure you want to clear your artwork?");

    if (!confirmed) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    saveHistory();

    status.textContent = "Canvas cleared";

});


// 20. DOWNLOAD ARTWORK

downloadButton.addEventListener("click", () => {

    if (drawing) {
        status.textContent = "Finish drawing before downloading";
        return;
    }

    const link = document.createElement("a");

    link.download = "my-pixelcraft-artwork.png";

    link.href = canvas.toDataURL("image/png");

    link.click();

    status.textContent = "Artwork downloaded!";

});


// 21. NIGHT / DAY MODE

const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {

    document.documentElement.setAttribute("data-theme", theme);

    try {
        localStorage.setItem("pixelcraft-theme", theme);
    } catch (error) {
        // Storage can be blocked; the theme still works for this visit.
    }

}

themeToggle.addEventListener("click", () => {

    const isDark =
        document.documentElement.getAttribute("data-theme") === "dark";

    applyTheme(isDark ? "light" : "dark");

    status.textContent = isDark ? "Day mode on" : "Night mode on";

});


// 22. START UP

chooseColour("#4f6bff", "Ready to create");
updateBrushPreview();