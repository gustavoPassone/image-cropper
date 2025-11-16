// --- Referências do DOM ---
const mainContainer = document.getElementById("main-container");
const uploadStep = document.getElementById("upload-step");
const editStep = document.getElementById("edit-step");
const resultStep = document.getElementById("result-step");

const dropZone = document.getElementById("drop-zone");
const selectButton = document.getElementById("select-button");
const fileInput = document.getElementById("file-input");

const opencvStatus = document.getElementById("opencv-status");
const uploadInstructions = document.getElementById("upload-instructions");
const uploadButtons = document.getElementById("upload-buttons");

const canvasWrapper = document.getElementById("canvas-wrapper");
const editCanvas = document.getElementById("edit-canvas");
const editCtx = editCanvas.getContext("2d");
const loupeCanvas = document.getElementById("loupe-canvas");
const loupeCtx = loupeCanvas.getContext("2d");

const cropButton = document.getElementById("crop-button");
const resetButton = document.getElementById("reset-button");
const rotateButton = document.getElementById("rotate-button");
const cancelButton = document.getElementById("cancel-button");
const backToPreviewButton = document.getElementById("back-to-preview-button");

// Etapa de Pré-visualização (Genérica)
const previewStep = document.getElementById("preview-step");
const thumbnailsContainer = document.getElementById("thumbnails-container");
const thumbnails = document.getElementById("thumbnails");
const previewTitle = document.getElementById("preview-title");
const cancelPreviewButton = document.getElementById("cancel-preview-button");
const downloadPdfButton = document.getElementById("download-pdf-button");
const downloadZipButton = document.getElementById("download-zip-button");

const resultCanvas = document.getElementById("result-canvas");
const startOverButton = document.getElementById("start-over-button");
const editAnotherPageButton = document.getElementById(
  "edit-another-page-button"
);

// NOVAS Referências para Opções de Exportação
const exportOptions = document.getElementById("export-options");
const exportFilenameInput = document.getElementById("export-filename-input");
const exportFormatSelect = document.getElementById("export-format-select");
const exportButton = document.getElementById("export-button");

// NOVAS Referências para Filtros de Pós-Processamento
const postProcessingToolbar = document.getElementById(
  "post-processing-toolbar"
);
const filterMagicButton = document.getElementById("filter-magic-button");
const filterNoneButton = document.getElementById("filter-none-button");
const filterBwButton = document.getElementById("filter-bw-button");
const filterContrastButton = document.getElementById("filter-contrast-button");
const filterSharpenButton = document.getElementById("filter-sharpen-button");
const filterRotateButton = document.getElementById("filter-rotate-button");
const sliderContainer = document.getElementById("slider-container");
const intensitySlider = document.getElementById("intensity-slider");
const sliderValue = document.getElementById("slider-value");

// NOVAS Referências para Limpeza Avançada
const cleanupButton = document.getElementById("cleanup-button");
const cleanupControls = document.getElementById("cleanup-controls");
const brushSizeSlider = document.getElementById("brush-size-slider");
const brushSizeValue = document.getElementById("brush-size-value");
const cleanupApplyButton = document.getElementById("cleanup-apply-button");
const cleanupCancelButton = document.getElementById("cleanup-cancel-button");

const modalOverlay = document.getElementById("modal-overlay");
const modalBtnYes = document.getElementById("modal-btn-yes");
const modalBtnNo = document.getElementById("modal-btn-no");

// --- Variáveis de Estado ---
let originalImage; // O objeto Image() (renderizado do PDF ou da Imagem)
let originalFileName = "";
let originalFileType = "image/png"; // 'image/png' ou 'application/pdf'
let displayedImageWidth;
let displayedImageHeight;
let points = [];
let draggingPoint = null;
let rotationAngle = 0;
let canvasScale = 1;

// Novas variáveis de estado para múltiplos arquivos
let currentMode = "single"; // 'single', 'pdf', 'batch-image'
let loadedPdf = null;
let loadedImageFiles = []; // Armazena os File objects para batch de imagens
let totalItems = 0; // total de páginas ou imagens
let currentEditingIndex = 0; // index da página ou imagem
let editedItems = new Map(); // Armazena itens editados (index -> dataURL)
let pageOrder = []; // Ordem atual das páginas/imagens
let itemRotations = new Map(); // Rotação individual de cada item

// Novas variáveis de estado para Pós-Processamento
let correctedImageMat = null; // cv.Mat com a imagem original corrigida
let currentFilter = "none"; // 'none', 'bw', 'contrast', 'sharpen', 'magic'

// NOVAS: Variáveis para Zoom/Pan na tela de resultado
const tempCanvasForFilters = document.createElement("canvas"); // Canvas temporário para filtros
let resultImage = null; // Vai guardar a imagem final como ImageBitmap para performance
let baseImageWidth, baseImageHeight; // Dimensões da imagem no resultCanvas
let resultZoom = 1;
let resultPan = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };

// NOVAS: Variáveis para Limpeza Avançada
let isCleanupModeActive = false;
let isBrushing = false;
let brushPath = [];
let brushSize = 30;

// ... Constantes de desenho (POINT_RADIUS, etc.) ...
const POINT_RADIUS = 25;
const CLICK_RADIUS = 40;
const LINE_WIDTH = 3;
const POINT_FILL_COLOR = "rgba(128, 128, 128, 0.4)";
const POINT_STROKE_COLOR = "rgba(0, 150, 255, 0.9)";
const DRAGGING_STROKE_COLOR = "rgba(255, 0, 0, 0.9)";

// Novas constantes para a Lupa
const LOUPE_SIZE = 150;
const LOUPE_ZOOM = 10;

// Constante para limite de arquivo
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// --- 1. Inicialização do OpenCV ---

// Flag para evitar que a função seja chamada múltiplas vezes
let isCvReady = false;

function onOpenCvReady() {
  if (isCvReady) return;
  isCvReady = true;

  console.log("OpenCV.js está pronto.");
  opencvStatus.textContent = "Bibliotecas carregadas!";
  opencvStatus.classList.remove("text-gray-700");
  opencvStatus.classList.add("text-green-600");
  uploadInstructions.classList.remove("hidden");
  uploadButtons.classList.remove("hidden");

  setupUploadListeners();
}

if (typeof cv !== "undefined") {
  onOpenCvReady();
} else {
  const opencvScript = document.getElementById("opencv-script");
  if (opencvScript) {
    opencvScript.addEventListener("error", () => {
      opencvStatus.textContent = "Falha ao carregar a biblioteca OpenCV.";
      opencvStatus.classList.remove("text-gray-700");
      opencvStatus.classList.add("text-red-600");
    });
  }
}

// --- 2. Lógica de Upload (Refatorada para Múltiplos Arquivos) ---

function setupUploadListeners() {
  selectButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });
}

function handleFiles(files) {
  if (files.length === 1) {
    handleSingleFile(files[0]);
  } else {
    handleMultipleFiles(files);
  }
}

function handleSingleFile(file) {
  // Verificação de tamanho do arquivo
  if (file.size > MAX_FILE_SIZE_BYTES) {
    alert(
      `Este arquivo é muito grande (Limite: ${MAX_FILE_SIZE_MB}MB) e pode travar seu navegador.`
    );
    fileInput.value = null; // Limpa o input para permitir nova seleção
    return;
  }

  const fileType = file.type;

  if (!fileType.startsWith("image/") && fileType !== "application/pdf") {
    alert("Por favor, selecione um arquivo de imagem (PNG, JPG) ou PDF.");
    return;
  }
  resetToUploadScreen(); // Garante que o estado anterior seja limpo

  originalFileName = file.name;
  originalFileType = file.type;
  rotationAngle = 0;

  if (fileType.startsWith("image/")) {
    currentMode = "single";
    originalImage = new Image();
    originalImage.src = URL.createObjectURL(file);
    originalImage.onload = () => {
      showEditScreen();
    };
    originalImage.onerror = () => {
      alert("Não foi possível carregar a imagem.");
    };
  } else if (fileType === "application/pdf") {
    currentMode = "pdf";
    opencvStatus.textContent = "Renderizando PDF...";
    uploadStep.classList.remove("hidden");
    editStep.classList.add("hidden");
    previewStep.classList.add("hidden");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target.result;
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;

        loadedPdf = pdfDoc;
        totalItems = pdfDoc.numPages;
        pageOrder = Array.from({ length: totalItems }, (_, i) => i + 1);

        if (totalItems === 1) {
          await loadPdfPageIntoEditor(1);
        } else {
          downloadPdfButton.classList.remove("hidden");
          downloadZipButton.classList.add("hidden");
          opencvStatus.textContent = "Carregando miniaturas...";
          await renderPdfThumbnails();
          uploadStep.classList.add("hidden");
          previewStep.classList.remove("hidden");
          opencvStatus.textContent = "Bibliotecas carregadas!";
        }
      } catch (error) {
        console.error("Erro ao carregar PDF:", error);
        alert("Não foi possível carregar o arquivo PDF.");
        resetToUploadScreen();
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function handleMultipleFiles(files) {
  resetToUploadScreen();
  const imageFiles = Array.from(files).filter((file) =>
    file.type.startsWith("image/")
  );

  if (imageFiles.length !== files.length) {
    alert(
      "Por favor, selecione apenas arquivos de imagem (JPG, PNG) para o processamento em lote."
    );
    return;
  }

  let totalSize = imageFiles.reduce((acc, file) => acc + file.size, 0);
  if (totalSize > MAX_FILE_SIZE_BYTES * 2) {
    // Limite maior para lote
    alert(
      `O tamanho total dos arquivos é muito grande e pode travar seu navegador.`
    );
    return;
  }

  currentMode = "batch-image";
  loadedImageFiles = imageFiles;
  totalItems = imageFiles.length;
  pageOrder = Array.from({ length: totalItems }, (_, i) => i + 1);
  originalFileName = "lote-de-imagens";

  downloadPdfButton.classList.remove("hidden");
  downloadZipButton.classList.remove("hidden");
  opencvStatus.textContent = "Carregando miniaturas...";
  renderImageThumbnails();
  uploadStep.classList.add("hidden");
  previewStep.classList.remove("hidden");
  opencvStatus.textContent = "Bibliotecas carregadas!";
}

async function loadPdfPageIntoEditor(pageNum) {
  if (!loadedPdf) return;
  currentEditingIndex = pageNum;

  try {
    const page = await loadedPdf.getPage(pageNum);
    const scale = 2.0;
    const viewport = page.getViewport({ scale });
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = viewport.width;
    tempCanvas.height = viewport.height;
    await page.render({ canvasContext: tempCtx, viewport }).promise;
    originalImage = new Image();
    originalImage.src = tempCanvas.toDataURL("image/png");
    originalImage.onload = showEditScreen;
    originalImage.onerror = () =>
      alert("Não foi possível carregar a imagem do PDF.");
  } catch (error) {
    console.error(`Erro ao carregar página ${pageNum}:`, error);
    alert(`Não foi possível carregar a página ${pageNum}.`);
    resetToUploadScreen();
  }
}

function loadImageIntoEditor(index) {
  if (!loadedImageFiles[index]) return;
  currentEditingIndex = index + 1; // 1-based index
  const file = loadedImageFiles[index];

  opencvStatus.textContent = `Carregando imagem ${index + 1}...`;
  uploadStep.classList.remove("hidden");
  previewStep.classList.add("hidden");

  originalImage = new Image();
  originalImage.src = URL.createObjectURL(file);
  originalImage.onload = showEditScreen;
  originalImage.onerror = () =>
    alert("Não foi possível carregar a imagem selecionada.");
}

function reRenderThumbnails() {
  if (currentMode === "pdf") {
    renderPdfThumbnails();
  } else if (currentMode === "batch-image") {
    renderImageThumbnails();
  }
}

async function renderPdfThumbnails() {
  if (!loadedPdf) return;
  thumbnails.innerHTML = "";
  previewTitle.textContent = `Selecione uma Página para Editar (${pageOrder.length} páginas)`;

  for (const pageNum of pageOrder) {
    createThumbnailElement(pageNum, `Página ${pageNum}`);
    updateThumbnail(pageNum);
  }
  lucide.createIcons();
}

function renderImageThumbnails() {
  thumbnails.innerHTML = "";
  previewTitle.textContent = `Selecione uma Imagem para Editar (${pageOrder.length} imagens)`;

  pageOrder.forEach((itemNum) => {
    createThumbnailElement(itemNum, `Imagem ${itemNum}`);
    updateThumbnail(itemNum);
  });
  lucide.createIcons();
}

function createThumbnailElement(itemNum, label) {
  const wrapper = document.createElement("div");
  wrapper.className = "thumbnail-item";
  wrapper.id = `thumbnail-item-${itemNum}`;
  wrapper.draggable = true;

  if (editedItems.has(itemNum)) {
    wrapper.classList.add("edited");
  }

  const canvasWrapper = document.createElement("div");
  canvasWrapper.className = "thumbnail-canvas-wrapper";

  const actions = document.createElement("div");
  actions.className = "thumbnail-actions";
  actions.innerHTML = `
        <button class="thumbnail-action-btn rotate-thumb-btn" title="Girar 90°"><i data-lucide="rotate-cw" class="w-4 h-4"></i></button>
        <button class="thumbnail-action-btn delete-thumb-btn" title="Excluir"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;

  const canvas = document.createElement("canvas");
  const p = document.createElement("p");
  p.textContent = label;

  wrapper.addEventListener("click", () => {
    previewStep.classList.add("hidden");
    opencvStatus.textContent = `Carregando item ${itemNum}...`;
    uploadStep.classList.remove("hidden");
    if (currentMode === "pdf") {
      loadPdfPageIntoEditor(itemNum);
    } else {
      const originalIndex = itemNum - 1;
      loadImageIntoEditor(originalIndex);
    }
  });

  actions.querySelector(".rotate-thumb-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    rotateItem(itemNum);
  });
  actions.querySelector(".delete-thumb-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    deleteItem(itemNum);
  });

  canvasWrapper.appendChild(actions);
  canvasWrapper.appendChild(canvas);
  wrapper.appendChild(canvasWrapper);
  wrapper.appendChild(p);
  thumbnails.appendChild(wrapper);
}

async function updateThumbnail(itemNum, dataUrl = null) {
  const wrapper = document.getElementById(`thumbnail-item-${itemNum}`);
  if (!wrapper) return;
  const canvas = wrapper.querySelector("canvas");
  const ctx = canvas.getContext("2d");

  const rotation = itemRotations.get(itemNum) || 0;

  const renderImage = (src) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const canvasWrapper = wrapper.querySelector(".thumbnail-canvas-wrapper");
      const wrapperWidth = canvasWrapper.clientWidth;
      const wrapperHeight = canvasWrapper.clientHeight;

      canvas.width = wrapperWidth;
      canvas.height = wrapperHeight;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);

      // Calculate the scale to fit the image inside the canvas while respecting aspect ratio
      const scale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
      );
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;

      ctx.drawImage(
        img,
        -drawWidth / 2,
        -drawHeight / 2,
        drawWidth,
        drawHeight
      );
      ctx.restore();

      if (currentMode === "batch-image" && !dataUrl) URL.revokeObjectURL(src); // Clean up
    };
  };

  if (dataUrl || editedItems.has(itemNum)) {
    renderImage(dataUrl || editedItems.get(itemNum));
    wrapper.classList.add("edited");
  } else if (currentMode === "pdf" && loadedPdf) {
    try {
      const page = await loadedPdf.getPage(itemNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const tempCanvas = document.createElement("canvas");
      const tempCtx = tempCanvas.getContext("2d");
      tempCanvas.width = viewport.width;
      tempCanvas.height = viewport.height;
      await page.render({ canvasContext: tempCtx, viewport }).promise;
      renderImage(tempCanvas.toDataURL());
    } catch (error) {
      console.error(`Erro ao renderizar miniatura ${itemNum}:`, error);
      wrapper.querySelector("p").textContent = `Erro Pág. ${itemNum}`;
    }
  } else if (currentMode === "batch-image" && loadedImageFiles[itemNum - 1]) {
    const file = loadedImageFiles[itemNum - 1];
    renderImage(URL.createObjectURL(file));
  }
}

function rotateItem(itemNum) {
  const currentAngle = itemRotations.get(itemNum) || 0;
  const newAngle = (currentAngle + 90) % 360;
  itemRotations.set(itemNum, newAngle);
  updateThumbnail(itemNum);
}

function deleteItem(itemNum) {
  if (pageOrder.length <= 1) {
    alert("Você não pode excluir o último item.");
    return;
  }
  const indexToDelete = pageOrder.indexOf(itemNum);
  if (indexToDelete > -1) {
    pageOrder.splice(indexToDelete, 1);
    editedItems.delete(itemNum);
    itemRotations.delete(itemNum);
    totalItems--;
    reRenderThumbnails();
  }
}

function showEditScreen() {
  uploadStep.classList.add("hidden");
  resultStep.classList.add("hidden");
  editStep.classList.remove("hidden");

  if (currentMode === "pdf" || currentMode === "batch-image") {
    backToPreviewButton.classList.remove("hidden");
  } else {
    backToPreviewButton.classList.add("hidden");
  }

  initializeCanvas();
}

// --- 3. Lógica de Edição (Canvas) ---

function getRotatedDimensions() {
  const isRotated90or270 = rotationAngle % 180 !== 0;
  if (isRotated90or270) {
    return { width: originalImage.height, height: originalImage.width };
  }
  return { width: originalImage.width, height: originalImage.height };
}

function initializeCanvas() {
  if (!originalImage) return;
  const maxWidth = canvasWrapper.clientWidth * 0.9;
  const maxHeight = window.innerHeight * 0.7;
  const rotatedDims = getRotatedDimensions();
  let originalRotatedWidth = rotatedDims.width;
  let originalRotatedHeight = rotatedDims.height;
  let scaleFactor = Math.min(
    1,
    maxWidth / originalRotatedWidth,
    maxHeight / originalRotatedHeight
  );

  displayedImageWidth = originalRotatedWidth * scaleFactor;
  displayedImageHeight = originalRotatedHeight * scaleFactor;
  editCanvas.width = displayedImageWidth;
  editCanvas.height = displayedImageHeight;

  let autoPoints = findDocumentCorners(originalImage);
  if (autoPoints && autoPoints.length === 4) {
    points = autoPoints.map((p) => ({
      x: p.x * scaleFactor,
      y: p.y * scaleFactor,
    }));
    if (
      points.some(
        (p) =>
          p.x > displayedImageWidth ||
          p.y > displayedImageHeight ||
          p.x < 0 ||
          p.y < 0
      )
    ) {
      autoPoints = null; // Invalida pontos fora da tela
    }
  }

  if (!autoPoints || autoPoints.length !== 4) {
    const margin = Math.min(displayedImageWidth, displayedImageHeight) * 0.1;
    points = [
      { x: margin, y: margin },
      { x: displayedImageWidth - margin, y: margin },
      { x: displayedImageWidth - margin, y: displayedImageHeight - margin },
      { x: margin, y: displayedImageHeight - margin },
    ];
  }
  drawCanvas();
}

function drawCanvas() {
  if (!originalImage) return;
  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  editCtx.save();
  editCtx.translate(editCanvas.width / 2, editCanvas.height / 2);
  editCtx.rotate((rotationAngle * Math.PI) / 180);
  const isRotated90or270 = rotationAngle % 180 !== 0;
  let imageWidth = isRotated90or270
    ? displayedImageHeight
    : displayedImageWidth;
  let imageHeight = isRotated90or270
    ? displayedImageWidth
    : displayedImageHeight;
  editCtx.drawImage(
    originalImage,
    -imageWidth / 2,
    -imageHeight / 2,
    imageWidth,
    imageHeight
  );
  editCtx.restore();

  editCtx.strokeStyle = POINT_STROKE_COLOR;
  editCtx.lineWidth = LINE_WIDTH;
  editCtx.beginPath();
  editCtx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    editCtx.lineTo(points[i].x, points[i].y);
  }
  editCtx.closePath();
  editCtx.stroke();

  points.forEach((p, index) => {
    editCtx.fillStyle = POINT_FILL_COLOR;
    editCtx.strokeStyle =
      index === draggingPoint ? DRAGGING_STROKE_COLOR : POINT_STROKE_COLOR;
    editCtx.lineWidth = LINE_WIDTH;
    editCtx.beginPath();
    editCtx.arc(p.x, p.y, POINT_RADIUS, 0, 2 * Math.PI);
    editCtx.fill();
    editCtx.stroke();
  });
}

function getCanvasPos(e) {
  const rect = editCanvas.getBoundingClientRect();
  canvasScale = editCanvas.width / rect.width;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * canvasScale,
    y: (clientY - rect.top) * canvasScale,
  };
}

function findPoint(x, y) {
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const dist = Math.hypot(p.x - x, p.y - y);
    if (dist < CLICK_RADIUS) return i;
  }
  return null;
}

function updateLoupe(x, y) {
  // Configura o tamanho do canvas da lupa
  loupeCanvas.width = LOUPE_SIZE;
  loupeCanvas.height = LOUPE_SIZE;

  // Posiciona a lupa em relação ao wrapper principal do canvas
  const canvasRect = editCanvas.getBoundingClientRect();
  const wrapperRect = canvasWrapper.getBoundingClientRect();

  const offsetX = canvasRect.left - wrapperRect.left;
  const offsetY = canvasRect.top - wrapperRect.top;

  // A posição do cursor no elemento canvas (que pode estar escalado)
  const displayX = x / canvasScale;
  const displayY = y / canvasScale;

  // Posiciona a lupa com um deslocamento
  let loupeTop = displayY + offsetY - LOUPE_SIZE - 20;
  let loupeLeft = displayX + offsetX + 20;

  // Mantém a lupa dentro da área visível do wrapper, se possível
  if (loupeTop < 0) {
    loupeTop = displayY + offsetY + 20;
  }
  if (loupeLeft + LOUPE_SIZE > wrapperRect.width) {
    loupeLeft = displayX + offsetX - LOUPE_SIZE - 20;
  }

  loupeCanvas.style.top = `${loupeTop}px`;
  loupeCanvas.style.left = `${loupeLeft}px`;

  // Desenha o conteúdo ampliado
  loupeCtx.fillStyle = "white";
  loupeCtx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);

  const sourceSize = LOUPE_SIZE / LOUPE_ZOOM;
  const sourceX = x - sourceSize / 2;
  const sourceY = y - sourceSize / 2;

  loupeCtx.drawImage(
    editCanvas,
    sourceX,
    sourceY, // Posição do retângulo de origem
    sourceSize,
    sourceSize, // Tamanho do retângulo de origem
    0,
    0, // Posição do retângulo de destino
    LOUPE_SIZE,
    LOUPE_SIZE // Tamanho do retângulo de destino
  );

  // Desenha uma mira para precisão
  loupeCtx.strokeStyle = "rgba(255, 0, 0, 0.7)";
  loupeCtx.lineWidth = 1;
  loupeCtx.beginPath();
  loupeCtx.moveTo(LOUPE_SIZE / 2, 0);
  loupeCtx.lineTo(LOUPE_SIZE / 2, LOUPE_SIZE);
  loupeCtx.moveTo(0, LOUPE_SIZE / 2);
  loupeCtx.lineTo(LOUPE_SIZE, LOUPE_SIZE / 2);
  loupeCtx.stroke();
}

function hideLoupe() {
  loupeCanvas.style.display = "none";
}

function onDown(e) {
  e.preventDefault();
  const pos = getCanvasPos(e);
  draggingPoint = findPoint(pos.x, pos.y);
  if (draggingPoint !== null) {
    drawCanvas();
    loupeCanvas.style.display = "block";
    updateLoupe(pos.x, pos.y);
  }
}

function onMove(e) {
  if (draggingPoint === null) return;
  e.preventDefault();
  const pos = getCanvasPos(e);
  points[draggingPoint].x = Math.max(0, Math.min(displayedImageWidth, pos.x));
  points[draggingPoint].y = Math.max(0, Math.min(displayedImageHeight, pos.y));
  drawCanvas();
  updateLoupe(pos.x, pos.y);
}

function onUp(e) {
  if (draggingPoint !== null) {
    draggingPoint = null;
    drawCanvas();
  }
  hideLoupe();
}

function rotateImage() {
  if (!originalImage) return;
  rotationAngle = (rotationAngle + 90) % 360;
  initializeCanvas();
}

function findDocumentCorners(imageElement) {
  // ... (código existente sem alterações)
  let src;
  let gray;
  let blurred;
  let edged;
  let contours;
  let hierarchy;
  let bestApprox;
  try {
    src = cv.imread(imageElement);
    gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    edged = new cv.Mat();
    cv.Canny(blurred, edged, 75, 200);
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    cv.findContours(
      edged,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );
    let maxArea = 0;
    bestApprox = null;
    for (let i = 0; i < contours.size(); ++i) {
      let cnt = contours.get(i);
      let area = cv.contourArea(cnt);
      if (area > (src.rows * src.cols) / 20) {
        let peri = cv.arcLength(cnt, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4 && area > maxArea) {
          maxArea = area;
          if (bestApprox) {
            bestApprox.delete();
          }
          bestApprox = approx;
        } else {
          approx.delete();
        }
      }
      cnt.delete();
    }
    if (bestApprox) {
      let pts = [
        { x: bestApprox.data32S[0], y: bestApprox.data32S[1] },
        { x: bestApprox.data32S[2], y: bestApprox.data32S[3] },
        { x: bestApprox.data32S[4], y: bestApprox.data32S[5] },
        { x: bestApprox.data32S[6], y: bestApprox.data32S[7] },
      ];
      pts.sort((a, b) => a.y - b.y);
      let top = pts.slice(0, 2).sort((a, b) => a.x - b.x);
      let bottom = pts.slice(2, 4).sort((a, b) => a.x - b.x);
      let orderedPoints = [top[0], top[1], bottom[1], bottom[0]];
      bestApprox.delete();
      return orderedPoints;
    }
    return null;
  } catch (error) {
    console.error("Auto-crop falhou:", error);
    return null;
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (blurred) blurred.delete();
    if (edged) edged.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
    if (bestApprox && !bestApprox.isDeleted()) bestApprox.delete();
  }
}

// --- 4. Processamento, Salvamento e Exportação ---

// NOVA: Função para redesenhar o canvas de resultado com zoom, pan e sobreposição de pincel
function drawResultCanvas() {
  if (!resultImage) return;
  const ctx = resultCanvas.getContext("2d");
  resultCanvas.width = baseImageWidth;
  resultCanvas.height = baseImageHeight;
  ctx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  ctx.save();
  ctx.translate(resultPan.x, resultPan.y);
  ctx.scale(resultZoom, resultZoom);
  ctx.drawImage(resultImage, 0, 0);

  // Desenha a sobreposição do pincel se estiver no modo de limpeza
  if (isCleanupModeActive && brushPath.length > 0) {
    ctx.strokeStyle = "rgba(255, 0, 255, 0.7)";
    ctx.fillStyle = "rgba(255, 0, 255, 0.3)";
    ctx.lineWidth = brushSize / resultZoom; // O tamanho da linha deve ser ajustado pelo zoom
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(brushPath[0].x, brushPath[0].y);
    for (let i = 1; i < brushPath.length; i++) {
      ctx.lineTo(brushPath[i].x, brushPath[i].y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// NOVA: Função auxiliar para atualizar a imagem de resultado a partir de um canvas fonte
async function updateResultImage(sourceCanvas) {
  if (resultImage && typeof resultImage.close === "function") {
    resultImage.close(); // Libera memória do bitmap anterior
  }
  try {
    resultImage = await createImageBitmap(sourceCanvas);
    baseImageWidth = resultImage.width;
    baseImageHeight = resultImage.height;
    drawResultCanvas();
  } catch (e) {
    console.error("Erro ao criar ImageBitmap:", e);
    // Fallback: usar o canvas diretamente se a criação do bitmap falhar
    baseImageWidth = sourceCanvas.width;
    baseImageHeight = sourceCanvas.height;
    resultImage = sourceCanvas; // Não é um bitmap, mas pode funcionar
    drawResultCanvas();
  }
}

// NOVA: Reseta o estado de zoom e pan
function resetZoomAndPan() {
  resultZoom = 1;
  resultPan = { x: 0, y: 0 };
  isPanning = false;
  resultCanvas.style.cursor = "grab"; // Cursor padrão para "agarrável"
}

// Função auxiliar para obter a matriz de transformação e o resultado do warp
function getWarpedResult() {
  const origW = originalImage.width,
    origH = originalImage.height;
  const rotatedDims = getRotatedDimensions();
  const originalRotatedWidth = rotatedDims.width,
    originalRotatedHeight = rotatedDims.height;
  const originalToDisplayedScaleX = originalRotatedWidth / displayedImageWidth;
  const originalToDisplayedScaleY =
    originalRotatedHeight / displayedImageHeight;
  const pointsOnRotatedOriginal = points.map((p) => ({
    x: p.x * originalToDisplayedScaleX,
    y: p.y * originalToDisplayedScaleY,
  }));

  let finalPointsOriginalScale = [];
  pointsOnRotatedOriginal.forEach((p) => {
    let x, y;
    if (rotationAngle === 90) {
      x = p.y;
      y = origH - p.x;
    } else if (rotationAngle === 180) {
      x = origW - p.x;
      y = origH - p.y;
    } else if (rotationAngle === 270) {
      x = origW - p.y;
      y = p.x;
    } else {
      x = p.x;
      y = p.y;
    }
    finalPointsOriginalScale.push(x, y);
  });

  const p0 = { x: finalPointsOriginalScale[0], y: finalPointsOriginalScale[1] },
    p1 = { x: finalPointsOriginalScale[2], y: finalPointsOriginalScale[3] };
  const p2 = { x: finalPointsOriginalScale[4], y: finalPointsOriginalScale[5] },
    p3 = { x: finalPointsOriginalScale[6], y: finalPointsOriginalScale[7] };
  const w1 = Math.hypot(p0.x - p1.x, p0.y - p1.y),
    w2 = Math.hypot(p3.x - p2.x, p3.y - p2.y);
  const h1 = Math.hypot(p0.x - p3.x, p0.y - p3.y),
    h2 = Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const outWidth = Math.round(Math.max(w1, w2)),
    outHeight = Math.round(Math.max(h1, h2));

  let src = cv.imread(originalImage);
  let srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, finalPointsOriginalScale);
  let dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0,
    0,
    outWidth - 1,
    0,
    outWidth - 1,
    outHeight - 1,
    0,
    outHeight - 1,
  ]);
  let M = cv.getPerspectiveTransform(srcPoints, dstPoints);
  let dst = new cv.Mat();
  let dsize = new cv.Size(outWidth, outHeight);
  cv.warpPerspective(
    src,
    dst,
    M,
    dsize,
    cv.INTER_LINEAR,
    cv.BORDER_CONSTANT,
    new cv.Scalar()
  );

  src.delete();
  M.delete();
  srcPoints.delete();
  dstPoints.delete();
  return dst;
}

// Para imagens únicas ou PDFs de página única
function processAndShowFinalResult() {
  try {
    const dst = getWarpedResult();

    if (correctedImageMat) {
      correctedImageMat.delete();
    }
    correctedImageMat = dst.clone(); // Armazena a imagem corrigida

    cv.imshow(resultCanvas, dst); // Ainda desenha uma vez para definir as dimensões
    dst.delete();

    resetZoomAndPan();
    updateResultImage(resultCanvas); // Cria o bitmap e desenha com o estado de zoom/pan

    const newFileNameBase = originalFileName.split(".").slice(0, -1).join(".");
    if (originalFileType === "application/pdf") {
      exportFilenameInput.value = `${newFileNameBase}-pagina-${currentEditingIndex}-corrigido`;
      exportFormatSelect.value = "pdf";
    } else {
      exportFilenameInput.value = `${newFileNameBase}-corrigido`;
      exportFormatSelect.value = "png";
    }

    startOverButton.classList.remove("hidden");
    if (
      (currentMode === "pdf" || currentMode === "batch-image") &&
      pageOrder.length > 1
    ) {
      editAnotherPageButton.classList.remove("hidden");
    } else {
      editAnotherPageButton.classList.add("hidden");
    }

    postProcessingToolbar.classList.remove("hidden");
    exportOptions.classList.remove("hidden");
    updateActiveFilterButton("none");

    editStep.classList.add("hidden");
    resultStep.classList.remove("hidden");
  } catch (error) {
    console.error("Erro no processamento do OpenCV:", error);
    alert("Ocorreu um erro ao processar a imagem. Tente novamente.");
  }
}

function saveItemAndReturnToThumbnails() {
  try {
    const dst = getWarpedResult();
    const tempCanvas = document.createElement("canvas");
    cv.imshow(tempCanvas, dst);
    const dataUrl = tempCanvas.toDataURL("image/png");

    editedItems.set(currentEditingIndex, dataUrl);
    updateThumbnail(currentEditingIndex, dataUrl);

    dst.delete();

    editStep.classList.add("hidden");
    previewStep.classList.remove("hidden");
  } catch (error) {
    console.error("Erro ao salvar item:", error);
    alert("Não foi possível salvar as alterações deste item.");
  }
}

// Função auxiliar para aplicar rotação em um dataURL
const getRotatedDataUrl = (dataUrl, angle) =>
  new Promise((resolve, reject) => {
    if (!angle) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const isRotated90or270 = angle % 180 !== 0;
      canvas.width = isRotated90or270 ? img.height : img.width;
      canvas.height = isRotated90or270 ? img.width : img.height;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });

async function buildAndDownloadPdfFromBatch() {
  opencvStatus.textContent = "Construindo PDF final...";
  uploadStep.classList.remove("hidden");
  previewStep.classList.add("hidden");

  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    pdf.deletePage(1); // Começa com um PDF em branco

    const loadImage = (src) =>
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const fileToDataURL = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    for (const itemNum of pageOrder) {
      opencvStatus.textContent = `Processando item ${
        pageOrder.indexOf(itemNum) + 1
      }/${pageOrder.length}...`;
      let dataUrl;
      if (editedItems.has(itemNum)) {
        dataUrl = editedItems.get(itemNum);
      } else if (currentMode === "pdf") {
        const page = await loadedPdf.getPage(itemNum);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport })
          .promise;
        dataUrl = canvas.toDataURL("image/png");
      } else if (currentMode === "batch-image") {
        dataUrl = await fileToDataURL(loadedImageFiles[itemNum - 1]);
      }

      if (dataUrl) {
        const rotation = itemRotations.get(itemNum) || 0;
        // A rotação já é aplicada na miniatura e deve ser aplicada na exportação final também.
        // A thumbnail renderiza a rotação via CSS, mas a exportação precisa de rotação de dados reais.
        const img = await loadImage(dataUrl);
        const rotatedCanvas = document.createElement("canvas");
        const rotatedCtx = rotatedCanvas.getContext("2d");
        const isRotated90or270 = rotation % 180 !== 0;

        rotatedCanvas.width = isRotated90or270 ? img.height : img.width;
        rotatedCanvas.height = isRotated90or270 ? img.width : img.height;

        rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
        rotatedCtx.rotate((rotation * Math.PI) / 180);
        rotatedCtx.drawImage(img, -img.width / 2, -img.height / 2);

        const finalDataUrl = rotatedCanvas.toDataURL("image/png");
        const finalImg = await loadImage(finalDataUrl);

        const w = finalImg.width;
        const h = finalImg.height;
        const orientation = w > h ? "l" : "p";
        pdf.addPage([w, h], orientation);
        pdf.addImage(finalImg, "PNG", 0, 0, w, h, undefined, "FAST");
      }
    }

    const newFileNameBase = originalFileName.split(".")[0];
    pdf.save(`${newFileNameBase}-compilado.pdf`);
    resetToUploadScreen();
  } catch (error) {
    console.error("Erro ao construir PDF final:", error);
    alert("Ocorreu um erro ao gerar o PDF final.");
    resetToUploadScreen();
  }
}

async function buildAndDownloadZip() {
  if (currentMode !== "batch-image") return;

  opencvStatus.textContent = "Construindo arquivo ZIP...";
  uploadStep.classList.remove("hidden");
  previewStep.classList.add("hidden");

  try {
    const zip = new JSZip();

    const dataURLToBlob = (dataURL) => {
      const byteString = atob(dataURL.split(",")[1]);
      const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mimeString });
    };

    const fileToDataURL = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

    for (let i = 0; i < pageOrder.length; i++) {
      const itemNum = pageOrder[i];
      const originalIndex = itemNum - 1;
      const file = loadedImageFiles[originalIndex];
      const fileName = `imagem_${String(i + 1).padStart(3, "0")}.png`;

      opencvStatus.textContent = `Adicionando item ${i + 1}/${
        pageOrder.length
      }...`;

      let dataUrl;
      if (editedItems.has(itemNum)) {
        dataUrl = editedItems.get(itemNum);
      } else {
        dataUrl = await fileToDataURL(file);
      }

      const rotation = itemRotations.get(itemNum) || 0;
      const finalDataUrl = await getRotatedDataUrl(dataUrl, rotation);
      zip.file(fileName, dataURLToBlob(finalDataUrl));
    }

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = `${originalFileName}.zip`;
    link.click();
    URL.revokeObjectURL(link.href);
    resetToUploadScreen();
  } catch (error) {
    console.error("Erro ao construir ZIP:", error);
    alert("Ocorreu um erro ao gerar o arquivo ZIP.");
    resetToUploadScreen();
  }
}

function handleExport() {
  const format = exportFormatSelect.value;
  const filename = exportFilenameInput.value.trim();
  if (!filename) {
    alert("Por favor, insira um nome para o arquivo.");
    exportFilenameInput.focus();
    return;
  }
  if (format === "pdf") {
    try {
      const imgData = resultCanvas.toDataURL("image/png");
      const w = resultCanvas.width;
      const h = resultCanvas.height;
      const orientation = w > h ? "l" : "p";
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation, unit: "px", format: [w, h] });
      pdf.addImage(imgData, "PNG", 0, 0, w, h);
      pdf.save(`${filename}.pdf`);
    } catch (e) {
      console.error("Erro ao gerar PDF:", e);
      alert("Não foi possível gerar o PDF.");
    }
  } else {
    const link = document.createElement("a");
    link.href = resultCanvas.toDataURL("image/png");
    link.download = `${filename}.png`;
    link.click();
    setTimeout(() => link.remove(), 100);
  }
}

// --- 5. Lógica de Pós-Processamento (Filtros e Limpeza) ---
function updateActiveFilterButton(activeFilter) {
  if (isCleanupModeActive) toggleCleanupMode(false); // Sai do modo limpeza
  currentFilter = activeFilter;

  const filterButtons = [
    filterNoneButton,
    filterBwButton,
    filterContrastButton,
    filterSharpenButton,
    filterMagicButton,
  ];
  const buttonMap = {
    none: filterNoneButton,
    bw: filterBwButton,
    contrast: filterContrastButton,
    sharpen: filterSharpenButton,
    magic: filterMagicButton,
  };

  filterButtons.forEach((btn) => {
    btn.classList.remove("bg-[#2F81F7]", "text-white");
    if (btn.id !== "filter-magic-button") {
      btn.classList.add("bg-[#30363D]", "text-[#C9D1D9]", "hover:bg-[#3d444c]");
    }
  });

  if (buttonMap[activeFilter]) {
    const activeBtn = buttonMap[activeFilter];
    if (activeFilter !== "magic") {
      activeBtn.classList.remove(
        "bg-[#30363D]",
        "text-[#C9D1D9]",
        "hover:bg-[#3d444c]"
      );
      activeBtn.classList.add("bg-[#2F81F7]", "text-white");
    }
  }

  if (["bw", "contrast", "sharpen"].includes(activeFilter)) {
    intensitySlider.value = 50;
    sliderValue.textContent = "50%";
    sliderContainer.classList.remove("hidden");
  } else {
    sliderContainer.classList.add("hidden");
  }

  applyPostProcessingEffects();
}

function applyPostProcessingEffects() {
  if (!correctedImageMat || correctedImageMat.isDeleted()) return;

  let matToDisplay;
  try {
    if (currentFilter === "magic") {
      matToDisplay = new cv.Mat();
      let gray = new cv.Mat();
      cv.cvtColor(correctedImageMat, gray, cv.COLOR_RGBA2GRAY);
      cv.adaptiveThreshold(
        gray,
        matToDisplay,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        11,
        4
      );
      gray.delete();
    } else if (currentFilter === "bw") {
      matToDisplay = new cv.Mat();
      let gray = new cv.Mat();
      cv.cvtColor(correctedImageMat, gray, cv.COLOR_RGBA2GRAY);
      const C = 15 - (parseInt(intensitySlider.value, 10) / 100) * 20;
      cv.adaptiveThreshold(
        gray,
        matToDisplay,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        11,
        C
      );
      gray.delete();
    } else if (currentFilter === "contrast") {
      const alpha = 1.0 + (parseInt(intensitySlider.value, 10) / 100) * 2.0;
      matToDisplay = new cv.Mat();
      correctedImageMat.convertTo(matToDisplay, -1, alpha, 0);
    } else if (currentFilter === "sharpen") {
      let sharpened = new cv.Mat();
      let kernel = cv.matFromArray(
        3,
        3,
        cv.CV_32F,
        [0, -1, 0, -1, 5, -1, 0, -1, 0]
      );
      cv.filter2D(
        correctedImageMat,
        sharpened,
        cv.CV_8U,
        kernel,
        new cv.Point(-1, -1),
        0,
        cv.BORDER_DEFAULT
      );

      const alpha = parseInt(intensitySlider.value, 10) / 100;
      const beta = 1.0 - alpha;

      matToDisplay = new cv.Mat();
      cv.addWeighted(
        sharpened,
        alpha,
        correctedImageMat,
        beta,
        0,
        matToDisplay,
        -1
      );

      sharpened.delete();
      kernel.delete();
    } else {
      // 'none'
      matToDisplay = correctedImageMat.clone();
    }

    cv.imshow(tempCanvasForFilters, matToDisplay);
    updateResultImage(tempCanvasForFilters);
  } catch (e) {
    console.error("Error applying filter", e);
    if (correctedImageMat && !correctedImageMat.isDeleted()) {
      cv.imshow(resultCanvas, correctedImageMat);
      updateResultImage(resultCanvas);
    }
  } finally {
    if (matToDisplay && !matToDisplay.isDeleted()) {
      matToDisplay.delete();
    }
  }
}

// NOVA: Lógica de Limpeza Avançada
function toggleCleanupMode(enable) {
  isCleanupModeActive = enable;
  if (enable) {
    currentFilter = "none"; // Reseta o filtro para evitar conflitos
    applyPostProcessingEffects(); // Mostra a imagem base
    postProcessingToolbar.classList.add("hidden");
    cleanupControls.classList.remove("hidden");
    resultCanvas.classList.add("cleanup-active");
    brushPath = [];
  } else {
    brushPath = [];
    drawResultCanvas(); // Remove a sobreposição do pincel
    postProcessingToolbar.classList.remove("hidden");
    cleanupControls.classList.add("hidden");
    resultCanvas.classList.remove("cleanup-active");
  }
}

function applyCleanup() {
  if (
    brushPath.length === 0 ||
    !correctedImageMat ||
    correctedImageMat.isDeleted()
  ) {
    toggleCleanupMode(false);
    return;
  }

  let mask, gray, processedRegion, processedRegionRgba;
  try {
    // 1. Criar a máscara para a área a ser limpa a partir dos traços do pincel.
    mask = new cv.Mat.zeros(
      correctedImageMat.rows,
      correctedImageMat.cols,
      cv.CV_8UC1
    );
    for (let i = 1; i < brushPath.length; i++) {
      const p1 = new cv.Point(
        Math.round(brushPath[i - 1].x),
        Math.round(brushPath[i - 1].y)
      );
      const p2 = new cv.Point(
        Math.round(brushPath[i].x),
        Math.round(brushPath[i].y)
      );
      cv.line(mask, p1, p2, new cv.Scalar(255), brushSize, cv.LINE_8, 0);
    }

    // 2. Criar uma versão em escala de cinza da imagem para processamento.
    gray = new cv.Mat();
    cv.cvtColor(correctedImageMat, gray, cv.COLOR_RGBA2GRAY);

    // 3. Aplicar o limiar adaptativo (o mesmo do "Filtro Mágico") na imagem inteira.
    // Isso separa eficientemente o texto do fundo.
    processedRegion = new cv.Mat();
    cv.adaptiveThreshold(
      gray,
      processedRegion,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      11,
      4
    );

    // 4. Converter o resultado preto e branco de volta para RGBA para que possa ser mesclado.
    processedRegionRgba = new cv.Mat();
    cv.cvtColor(processedRegion, processedRegionRgba, cv.COLOR_GRAY2RGBA);

    // 5. Copiar a região processada (limpa) para a imagem principal, usando a máscara.
    // Isso substitui efetivamente a área sombreada por sua versão limpa.
    processedRegionRgba.copyTo(correctedImageMat, mask);

    // 6. Atualizar a exibição com a imagem modificada.
    applyPostProcessingEffects();
  } catch (e) {
    console.error("Erro durante a limpeza avançada:", e);
    alert("Ocorreu um erro ao aplicar a limpeza.");
  } finally {
    // 7. Limpar todos os Mats temporários do OpenCV para evitar vazamentos de memória.
    if (mask) mask.delete();
    if (gray) gray.delete();
    if (processedRegion) processedRegion.delete();
    if (processedRegionRgba) processedRegionRgba.delete();
  }
  toggleCleanupMode(false);
}

// --- 6. Lógica dos Botões de Ação ---

function resetToUploadScreen() {
  fileInput.value = null;
  originalImage = null;
  originalFileName = "";
  originalFileType = "image/png";
  points = [];
  draggingPoint = null;
  rotationAngle = 0;

  // Reset de estado
  currentMode = "single";
  loadedPdf = null;
  loadedImageFiles = [];
  totalItems = 0;
  currentEditingIndex = 0;
  editedItems.clear();
  pageOrder = [];
  itemRotations.clear();

  if (correctedImageMat && !correctedImageMat.isDeleted()) {
    correctedImageMat.delete();
    correctedImageMat = null;
  }
  currentFilter = "none";
  if (isCleanupModeActive) toggleCleanupMode(false);

  if (resultImage && typeof resultImage.close === "function") {
    resultImage.close();
  }
  resultImage = null;
  resetZoomAndPan();

  editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);
  const resultCtx = resultCanvas.getContext("2d");
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

  resultStep.classList.add("hidden");
  editStep.classList.add("hidden");
  previewStep.classList.add("hidden");
  uploadStep.classList.remove("hidden");

  postProcessingToolbar.classList.add("hidden");
  exportOptions.classList.add("hidden");
  sliderContainer.classList.add("hidden");
  downloadPdfButton.classList.add("hidden");
  downloadZipButton.classList.add("hidden");
  startOverButton.classList.add("hidden");
  editAnotherPageButton.classList.add("hidden");
  backToPreviewButton.classList.add("hidden");

  opencvStatus.textContent = "Bibliotecas carregadas!";
  opencvStatus.classList.add("text-green-600");
}

function handleModalKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    modalBtnYes.click();
  } else if (e.key === "Escape") {
    e.preventDefault();
    modalBtnNo.click();
  }
}
function showModal() {
  modalOverlay.classList.remove("hidden");
  window.addEventListener("keydown", handleModalKeydown);
  modalBtnYes.focus();
}
function hideModal() {
  modalOverlay.classList.add("hidden");
  window.removeEventListener("keydown", handleModalKeydown);
}
modalBtnYes.addEventListener("click", () => {
  hideModal();
  resetToUploadScreen();
});
modalBtnNo.addEventListener("click", hideModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) hideModal();
});

// --- Listeners Principais ---
resetButton.addEventListener("click", initializeCanvas);
cropButton.addEventListener("click", () => {
  switch (currentMode) {
    case "pdf":
    case "batch-image":
      saveItemAndReturnToThumbnails();
      break;
    default:
      processAndShowFinalResult();
      break;
  }
});
rotateButton.addEventListener("click", rotateImage);
cancelButton.addEventListener("click", showModal);
backToPreviewButton.addEventListener("click", () => {
  editStep.classList.add("hidden");
  previewStep.classList.remove("hidden");
});
startOverButton.addEventListener("click", resetToUploadScreen);
exportButton.addEventListener("click", handleExport);
cancelPreviewButton.addEventListener("click", resetToUploadScreen);
downloadPdfButton.addEventListener("click", buildAndDownloadPdfFromBatch);
downloadZipButton.addEventListener("click", buildAndDownloadZip);

editAnotherPageButton.addEventListener("click", () => {
  resultStep.classList.add("hidden");
  previewStep.classList.remove("hidden");
});

// Listeners dos Filtros
filterMagicButton.addEventListener("click", () =>
  updateActiveFilterButton("magic")
);
filterNoneButton.addEventListener("click", () =>
  updateActiveFilterButton("none")
);
filterBwButton.addEventListener("click", () => updateActiveFilterButton("bw"));
filterContrastButton.addEventListener("click", () =>
  updateActiveFilterButton("contrast")
);
filterSharpenButton.addEventListener("click", () =>
  updateActiveFilterButton("sharpen")
);

intensitySlider.addEventListener("input", () => {
  sliderValue.textContent = `${intensitySlider.value}%`;
  applyPostProcessingEffects();
});

filterRotateButton.addEventListener("click", () => {
  if (!correctedImageMat || correctedImageMat.isDeleted()) return;
  try {
    let rotatedMat = new cv.Mat();
    cv.rotate(correctedImageMat, rotatedMat, cv.ROTATE_90_CLOCKWISE);
    correctedImageMat.delete(); // Deleta a matriz antiga
    correctedImageMat = rotatedMat; // Atribui a nova
    applyPostProcessingEffects(); // Reaplica o filtro na imagem rotacionada
  } catch (e) {
    console.error("Error rotating image: ", e);
  }
});

// Listeners da Limpeza Avançada
cleanupButton.addEventListener("click", () => toggleCleanupMode(true));
cleanupCancelButton.addEventListener("click", () => toggleCleanupMode(false));
cleanupApplyButton.addEventListener("click", applyCleanup);
brushSizeSlider.addEventListener("input", () => {
  brushSize = parseInt(brushSizeSlider.value, 10);
  brushSizeValue.textContent = `${brushSize}px`;
});

editCanvas.addEventListener("mousedown", onDown);
editCanvas.addEventListener("mousemove", onMove);
editCanvas.addEventListener("mouseup", onUp);
editCanvas.addEventListener("mouseout", onUp);
editCanvas.addEventListener("touchstart", onDown);
editCanvas.addEventListener("touchmove", onMove);
editCanvas.addEventListener("touchend", onUp);
editCanvas.addEventListener("touchcancel", onUp);

window.addEventListener("resize", () => {
  if (originalImage && !editStep.classList.contains("hidden")) {
    initializeCanvas();
  }
});

// --- NOVOS LISTENERS PARA ORGANIZADOR VISUAL (DRAG & DROP) ---
let draggingElement = null;

thumbnails.addEventListener("dragstart", (e) => {
  if (e.target.classList.contains("thumbnail-item")) {
    draggingElement = e.target;
    // Atraso para o navegador capturar a imagem do item antes de aplicar a classe
    requestAnimationFrame(() => {
      draggingElement.classList.add("dragging");
    });
  }
});

thumbnails.addEventListener("dragend", (e) => {
  if (draggingElement) {
    draggingElement.classList.remove("dragging");
    draggingElement = null;
  }
});

thumbnails.addEventListener("dragover", (e) => {
  e.preventDefault();
  if (!draggingElement) return;

  const afterElement = getDragAfterElement(thumbnails, e.clientX, e.clientY);

  if (afterElement == null) {
    thumbnails.appendChild(draggingElement);
  } else {
    thumbnails.insertBefore(draggingElement, afterElement);
  }
});

thumbnails.addEventListener("drop", (e) => {
  e.preventDefault();
  if (draggingElement) {
    const newPageOrder = Array.from(
      thumbnails.querySelectorAll(".thumbnail-item")
    ).map((item) => parseInt(item.id.split("-")[2]));
    pageOrder = newPageOrder;
  }
});

function getDragAfterElement(container, x, y) {
  const draggableElements = [
    ...container.querySelectorAll(".thumbnail-item:not(.dragging)"),
  ];

  let closestElement = null;
  let minDistance = Number.POSITIVE_INFINITY;

  draggableElements.forEach((child) => {
    const box = child.getBoundingClientRect();
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const distance = Math.hypot(x - centerX, y - centerY);

    if (distance < minDistance) {
      minDistance = distance;
      closestElement = child;
    }
  });

  if (closestElement) {
    const box = closestElement.getBoundingClientRect();
    // Decide if we should insert before the element or after it (before its next sibling)
    // This logic works well for grid-like layouts
    if (x > box.left + box.width / 2) {
      return closestElement.nextElementSibling;
    } else {
      return closestElement;
    }
  } else {
    return null; // If container is empty or has only the dragging element
  }
}

// --- NOVOS LISTENERS PARA ZOOM, PAN E PINCEL NO RESULTADO ---
function getResultCanvasPos(e) {
  const rect = resultCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  // Converte de coordenadas da tela para coordenadas do canvas (considerando o pan e zoom)
  const canvasX =
    ((mouseX / rect.width) * resultCanvas.width - resultPan.x) / resultZoom;
  const canvasY =
    ((mouseY / rect.height) * resultCanvas.height - resultPan.y) / resultZoom;
  return { x: canvasX, y: canvasY };
}

resultCanvas.addEventListener("wheel", (e) => {
  if (isCleanupModeActive) return;
  e.preventDefault();

  const rect = resultCanvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const canvasX = (mouseX / rect.width) * resultCanvas.width;
  const canvasY = (mouseY / rect.height) * resultCanvas.height;

  const zoomFactor = 1.1;
  const oldZoom = resultZoom;

  if (e.deltaY < 0) {
    resultZoom *= zoomFactor;
  } else {
    resultZoom /= zoomFactor;
  }

  resultZoom = Math.max(1, Math.min(resultZoom, 10));

  if (resultZoom <= 1) {
    resetZoomAndPan();
  } else {
    resultPan.x = canvasX - (canvasX - resultPan.x) * (resultZoom / oldZoom);
    resultPan.y = canvasY - (canvasY - resultPan.y) * (resultZoom / oldZoom);
  }

  drawResultCanvas();
});

resultCanvas.addEventListener("mousedown", (e) => {
  e.preventDefault();
  if (isCleanupModeActive) {
    isBrushing = true;
    brushPath = [getResultCanvasPos(e)];
  } else {
    if (resultZoom <= 1) return;
    isPanning = true;
    panStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      panX: resultPan.x,
      panY: resultPan.y,
    };
    resultCanvas.style.cursor = "grabbing";
  }
});

resultCanvas.addEventListener("mousemove", (e) => {
  if (isCleanupModeActive) {
    if (!isBrushing) return;
    brushPath.push(getResultCanvasPos(e));
    drawResultCanvas();
  } else {
    if (!isPanning) return;
    e.preventDefault();
    const dx = e.clientX - panStart.clientX;
    const dy = e.clientY - panStart.clientY;
    resultPan.x = panStart.panX + dx;
    resultPan.y = panStart.panY + dy;
    drawResultCanvas();
  }
});

const endAction = (e) => {
  if (isCleanupModeActive) {
    isBrushing = false;
  } else {
    if (!isPanning) return;
    isPanning = false;
    resultCanvas.style.cursor = "grab";
  }
};
resultCanvas.addEventListener("mouseup", endAction);
resultCanvas.addEventListener("mouseleave", endAction);

// --- 7. Service Worker Registration ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        console.log(
          "ServiceWorker registration successful with scope: ",
          registration.scope
        );
      })
      .catch((err) => {
        console.log("ServiceWorker registration failed: ", err);
      });
  });
}
