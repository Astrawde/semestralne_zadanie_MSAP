const audioFileInput = document.getElementById("audioFile");
const audioPlayer = document.getElementById("audioPlayer");
const analyzeBtn = document.getElementById("analyzeBtn");

const maxAmplitudeElement = document.getElementById("maxAmplitude");
const avgAmplitudeElement = document.getElementById("avgAmplitude");
const frequencyElement = document.getElementById("frequency");
const formulaElement = document.getElementById("formula");

const waveCanvas = document.getElementById("waveCanvas");
const waveCtx = waveCanvas.getContext("2d");

const functionCanvas = document.getElementById("functionCanvas");
const functionCtx = functionCanvas.getContext("2d");

const functionTypeSelect = document.getElementById("functionType");
const amplitudeSlider = document.getElementById("amplitudeSlider");
const frequencySlider = document.getElementById("frequencySlider");
const amplitudeValue = document.getElementById("amplitudeValue");
const frequencyValue = document.getElementById("frequencyValue");

const animateBtn = document.getElementById("animateBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");

let selectedAudioFile = null;
let lastAudioData = null;

let currentAmplitude = 0.5;
let currentFrequency = 100;

let originalAmplitude = 0.5;
let originalFrequency = 100;

let isAnimating = false;
let animationFrameId = null;
let animationPhase = 0;

// Výber audio súboru
audioFileInput.addEventListener("change", function () {
    selectedAudioFile = this.files[0];

    if (!selectedAudioFile) {
        alert("Súbor nebol vybraný.");
        return;
    }

    const audioURL = URL.createObjectURL(selectedAudioFile);
    audioPlayer.src = audioURL;
});

// Analýza zvuku
analyzeBtn.addEventListener("click", async function () {
    if (!selectedAudioFile) {
        alert("Najprv nahraj audio súbor.");
        return;
    }

    try {
        analyzeBtn.disabled = true;
        analyzeBtn.textContent = "Analyzujem...";

        const arrayBuffer = await selectedAudioFile.arrayBuffer();

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();

        if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;

        lastAudioData = channelData;

        const maxAmplitude = calculateMaxAmplitude(channelData);
        const avgAmplitude = calculateAverageAmplitude(channelData);
        const dominantFrequency = estimateDominantFrequency(channelData, sampleRate);

        currentAmplitude = maxAmplitude;
        currentFrequency = Math.min(dominantFrequency, 1000);

        originalAmplitude = currentAmplitude;
        originalFrequency = currentFrequency;

        maxAmplitudeElement.textContent = maxAmplitude.toFixed(3);
        avgAmplitudeElement.textContent = avgAmplitude.toFixed(3);
        frequencyElement.textContent = dominantFrequency.toFixed(2);

        amplitudeSlider.value = currentAmplitude;
        frequencySlider.value = currentFrequency;

        amplitudeValue.textContent = currentAmplitude.toFixed(2);
        frequencyValue.textContent = currentFrequency.toFixed(2) + " Hz";

        updateFormulaText(currentAmplitude, currentFrequency);

        drawMathFunction(currentAmplitude, currentFrequency, animationPhase);
        drawComparisonGraph();

    } catch (error) {
        console.error("Chyba pri analýze:", error);
        alert("Nepodarilo sa analyzovať audio súbor. Skús iný MP3 alebo WAV súbor.");
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = "Analyzovať zvuk";
    }
});

// Výpočet maximálnej amplitúdy
function calculateMaxAmplitude(data) {
    let max = 0;

    for (let i = 0; i < data.length; i++) {
        const value = Math.abs(data[i]);

        if (value > max) {
            max = value;
        }
    }

    return max;
}

// Výpočet priemernej amplitúdy
function calculateAverageAmplitude(data) {
    let sum = 0;

    for (let i = 0; i < data.length; i++) {
        sum += Math.abs(data[i]);
    }

    return sum / data.length;
}

// Jednoduchý odhad dominantnej frekvencie pomocou prechodov cez nulu
function estimateDominantFrequency(data, sampleRate) {
    let zeroCrossings = 0;

    for (let i = 1; i < data.length; i++) {
        if ((data[i - 1] < 0 && data[i] >= 0) || (data[i - 1] > 0 && data[i] <= 0)) {
            zeroCrossings++;
        }
    }

    const duration = data.length / sampleRate;
    return zeroCrossings / (2 * duration);
}

// Hodnota funkcie podľa zvoleného typu
function getFunctionValue(type, amplitude, visualFrequency, t, phase) {
    if (type === "sin") {
        return amplitude * Math.sin(2 * Math.PI * visualFrequency * t + phase);
    }

    if (type === "cos") {
        return amplitude * Math.cos(2 * Math.PI * visualFrequency * t + phase);
    }

    // Kombinovaná funkcia = Sin + Cos
    return (
        amplitude * Math.sin(2 * Math.PI * visualFrequency * t + phase) +
        (amplitude / 2) * Math.cos(2 * Math.PI * visualFrequency * 2 * t + phase)
    );
}

// Hlavný graf matematickej funkcie
function drawMathFunction(amplitude, frequency, phase = 0) {
    functionCtx.clearRect(0, 0, functionCanvas.width, functionCanvas.height);

    functionCtx.fillStyle = "#111827";
    functionCtx.fillRect(0, 0, functionCanvas.width, functionCanvas.height);

    drawGraphGrid(functionCtx, functionCanvas, "f(t)");

    const originX = 55;
    const originY = functionCanvas.height / 2;
    const graphWidth = functionCanvas.width - 85;
    const scaleY = 72;

    functionCtx.strokeStyle = "#22c55e";
    functionCtx.lineWidth = 2;
    functionCtx.beginPath();

    const visualFrequency = Math.max(1, Math.min(frequency / 50, 20));
    const functionType = functionTypeSelect.value;

    for (let pixel = 0; pixel <= graphWidth; pixel++) {
        const xValue = (pixel / graphWidth) * 10;
        const t = xValue / 10;

        const value = getFunctionValue(functionType, amplitude, visualFrequency, t, phase);

        const canvasX = originX + pixel;
        const canvasY = originY - value * scaleY;

        if (pixel === 0) {
            functionCtx.moveTo(canvasX, canvasY);
        } else {
            functionCtx.lineTo(canvasX, canvasY);
        }
    }

    functionCtx.stroke();

    drawFunctionPoints(amplitude, frequency, phase);
    updateFormulaText(amplitude, frequency);
}

// Mriežka hlavného grafu
function drawGraphGrid(ctx, canvas, title) {
    const originX = 55;
    const originY = canvas.height / 2;
    const graphWidth = canvas.width - 85;
    const graphHeight = canvas.height - 45;

    ctx.save();

    ctx.strokeStyle = "#243244";
    ctx.lineWidth = 1;

    for (let x = originX; x <= originX + graphWidth; x += graphWidth / 10) {
        ctx.beginPath();
        ctx.moveTo(x, 18);
        ctx.lineTo(x, canvas.height - 28);
        ctx.stroke();
    }

    for (let y = 18; y <= canvas.height - 28; y += graphHeight / 8) {
        ctx.beginPath();
        ctx.moveTo(originX, y);
        ctx.lineTo(originX + graphWidth, y);
        ctx.stroke();
    }

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(originX, originY);
    ctx.lineTo(originX + graphWidth, originY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(originX, 18);
    ctx.lineTo(originX, canvas.height - 28);
    ctx.stroke();

    ctx.fillStyle = "#e5e7eb";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";

    for (let i = 0; i <= 10; i++) {
        const x = originX + (graphWidth / 10) * i;

        ctx.fillText(i.toString(), x, originY + 20);

        ctx.beginPath();
        ctx.moveTo(x, originY - 4);
        ctx.lineTo(x, originY + 4);
        ctx.stroke();
    }

    ctx.textAlign = "right";
    ctx.fillText("1", originX - 8, originY - 68);
    ctx.fillText("0", originX - 8, originY + 4);
    ctx.fillText("-1", originX - 8, originY + 74);

    ctx.textAlign = "center";
    ctx.fillText("x / t", originX + graphWidth / 2, canvas.height - 8);

    ctx.save();
    ctx.translate(17, originY);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("y / f(t)", 0, 0);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillText(title, originX, 14);

    ctx.restore();
}

// Body na hlavnom grafe
function drawFunctionPoints(amplitude, frequency, phase = 0) {
    const originX = 55;
    const originY = functionCanvas.height / 2;
    const graphWidth = functionCanvas.width - 85;
    const scaleY = 72;

    const visualFrequency = Math.max(1, Math.min(frequency / 50, 20));
    const functionType = functionTypeSelect.value;

    functionCtx.fillStyle = "#facc15";
    functionCtx.strokeStyle = "#111827";
    functionCtx.lineWidth = 2;
    functionCtx.font = "11px Arial";
    functionCtx.textAlign = "center";

    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const value = getFunctionValue(functionType, amplitude, visualFrequency, t, phase);

        const x = originX + (graphWidth / 10) * i;
        const y = originY - value * scaleY;

        functionCtx.beginPath();
        functionCtx.arc(x, y, 4, 0, Math.PI * 2);
        functionCtx.fill();
        functionCtx.stroke();

        functionCtx.fillStyle = "#f9fafb";
        functionCtx.fillText(`(${i}, ${value.toFixed(2)})`, x, y - 8);
        functionCtx.fillStyle = "#facc15";
    }
}

// Bod 6: Porovnanie všetkých 3 módov
function drawComparisonGraph() {
    waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);

    const width = waveCanvas.width;
    const height = waveCanvas.height;

    const originX = 55;
    const originY = height / 2;
    const graphWidth = width - 85;
    const scaleY = 55;

    waveCtx.fillStyle = "#111827";
    waveCtx.fillRect(0, 0, width, height);

    // Mriežka
    waveCtx.strokeStyle = "#243244";
    waveCtx.lineWidth = 1;

    for (let x = originX; x <= originX + graphWidth; x += graphWidth / 10) {
        waveCtx.beginPath();
        waveCtx.moveTo(x, 18);
        waveCtx.lineTo(x, height - 28);
        waveCtx.stroke();
    }

    for (let y = 20; y <= height - 28; y += 30) {
        waveCtx.beginPath();
        waveCtx.moveTo(originX, y);
        waveCtx.lineTo(originX + graphWidth, y);
        waveCtx.stroke();
    }

    // Osi
    waveCtx.strokeStyle = "#e5e7eb";
    waveCtx.lineWidth = 2;

    waveCtx.beginPath();
    waveCtx.moveTo(originX, originY);
    waveCtx.lineTo(originX + graphWidth, originY);
    waveCtx.stroke();

    waveCtx.beginPath();
    waveCtx.moveTo(originX, 18);
    waveCtx.lineTo(originX, height - 28);
    waveCtx.stroke();

    // Popisy osi
    waveCtx.fillStyle = "#e5e7eb";
    waveCtx.font = "12px Arial";
    waveCtx.textAlign = "center";

    for (let i = 0; i <= 10; i++) {
        const x = originX + (graphWidth / 10) * i;
        waveCtx.fillText(i.toString(), x, originY + 20);
    }

    waveCtx.textAlign = "right";
    waveCtx.fillText("1", originX - 8, originY - 55);
    waveCtx.fillText("0", originX - 8, originY + 4);
    waveCtx.fillText("-1", originX - 8, originY + 61);

    // Nadpis
    waveCtx.textAlign = "left";
    waveCtx.fillText("Sin vs Cos vs Combined", originX, 14);

    // Legenda
    waveCtx.fillStyle = "#38bdf8";
    waveCtx.fillRect(width - 310, 12, 12, 12);
    waveCtx.fillStyle = "#e5e7eb";
    waveCtx.fillText("Sin", width - 292, 23);

    waveCtx.fillStyle = "#f97316";
    waveCtx.fillRect(width - 240, 12, 12, 12);
    waveCtx.fillStyle = "#e5e7eb";
    waveCtx.fillText("Cos", width - 222, 23);

    waveCtx.fillStyle = "#22c55e";
    waveCtx.fillRect(width - 165, 12, 12, 12);
    waveCtx.fillStyle = "#e5e7eb";
    waveCtx.fillText("Combined", width - 147, 23);

    const visualFrequency = Math.max(1, Math.min(currentFrequency / 50, 20));

    drawComparisonLine("sin", "#38bdf8", 2, visualFrequency, scaleY);
    drawComparisonLine("cos", "#f97316", 2, visualFrequency, scaleY);
    drawComparisonLine("combined", "#22c55e", 2.4, visualFrequency, scaleY);

    // Popisy osí
    waveCtx.fillStyle = "#cbd5e1";
    waveCtx.font = "12px Arial";
    waveCtx.textAlign = "center";
    waveCtx.fillText("čas / t", originX + graphWidth / 2, height - 8);

    waveCtx.save();
    waveCtx.translate(17, originY);
    waveCtx.rotate(-Math.PI / 2);
    waveCtx.fillText("amplitúda", 0, 0);
    waveCtx.restore();
}

// Pomocná funkcia na kreslenie čiary v bode 6
function drawComparisonLine(type, color, lineWidth, visualFrequency, scaleY) {
    const width = waveCanvas.width;
    const height = waveCanvas.height;

    const originX = 55;
    const originY = height / 2;
    const graphWidth = width - 85;

    waveCtx.strokeStyle = color;
    waveCtx.lineWidth = lineWidth;
    waveCtx.beginPath();

    for (let x = 0; x < graphWidth; x++) {
        const t = x / graphWidth;
        const value = getFunctionValue(type, currentAmplitude, visualFrequency, t, animationPhase);

        const canvasX = originX + x;
        const canvasY = originY - value * scaleY;

        if (x === 0) {
            waveCtx.moveTo(canvasX, canvasY);
        } else {
            waveCtx.lineTo(canvasX, canvasY);
        }
    }

    waveCtx.stroke();
}

// Aktualizácia textu vzorca
function updateFormulaText(amplitude, frequency) {
    const type = functionTypeSelect.value;

    if (type === "sin") {
        formulaElement.textContent =
            `f(t) = ${amplitude.toFixed(2)} · sin(2π · ${frequency.toFixed(2)} · t)`;
    } else if (type === "cos") {
        formulaElement.textContent =
            `f(t) = ${amplitude.toFixed(2)} · cos(2π · ${frequency.toFixed(2)} · t)`;
    } else {
        formulaElement.textContent =
            `f(t) = ${amplitude.toFixed(2)} · sin(2π · ${frequency.toFixed(2)} · t) + ${(amplitude / 2).toFixed(2)} · cos(2π · ${(frequency * 2).toFixed(2)} · t)`;
    }
}

// Prekreslenie pri zmene sliderov alebo typu funkcie
function redrawInteractiveFunction() {
    currentAmplitude = parseFloat(amplitudeSlider.value);
    currentFrequency = parseFloat(frequencySlider.value);

    amplitudeValue.textContent = currentAmplitude.toFixed(2);
    frequencyValue.textContent = currentFrequency.toFixed(2) + " Hz";

    drawMathFunction(currentAmplitude, currentFrequency, animationPhase);
    drawComparisonGraph();
}

// Animácia
function animateFunction() {
    if (!isAnimating) {
        return;
    }

    animationPhase += 0.05;

    drawMathFunction(currentAmplitude, currentFrequency, animationPhase);
    drawComparisonGraph();

    animationFrameId = requestAnimationFrame(animateFunction);
}

// Event listenery
amplitudeSlider.addEventListener("input", function () {
    redrawInteractiveFunction();
});

frequencySlider.addEventListener("input", function () {
    redrawInteractiveFunction();
});

functionTypeSelect.addEventListener("change", function () {
    redrawInteractiveFunction();
});

animateBtn.addEventListener("click", function () {
    isAnimating = !isAnimating;

    if (isAnimating) {
        animateBtn.textContent = "Zastaviť animáciu";
        animateFunction();
    } else {
        animateBtn.textContent = "Spustiť animáciu";
        cancelAnimationFrame(animationFrameId);
    }
});

resetBtn.addEventListener("click", function () {
    currentAmplitude = originalAmplitude;
    currentFrequency = originalFrequency;

    amplitudeSlider.value = currentAmplitude;
    frequencySlider.value = currentFrequency;

    amplitudeValue.textContent = currentAmplitude.toFixed(2);
    frequencyValue.textContent = currentFrequency.toFixed(2) + " Hz";

    drawMathFunction(currentAmplitude, currentFrequency, animationPhase);
    drawComparisonGraph();
});

exportBtn.addEventListener("click", function () {
    const imageURL = functionCanvas.toDataURL("image/png");

    const link = document.createElement("a");
    link.href = imageURL;
    link.download = "wave2function-graph.png";
    link.click();
});

// Prvé vykreslenie pri načítaní stránky
drawMathFunction(currentAmplitude, currentFrequency, 0);
drawComparisonGraph();