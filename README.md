# ✂️ Image Cropper - Recorte com Correção de Perspectiva

## 🌟 Visão Geral do Projeto

Este é um aplicativo web leve e eficiente projetado para corrigir a perspectiva de imagens, como fotos de documentos, quadros ou recibos tiradas em ângulo. O processamento é realizado **totalmente no lado do cliente (Client-Side)**, utilizando **OpenCV.js** para garantir velocidade e privacidade, pois as imagens nunca saem do navegador do usuário.

A interface permite que o usuário marque os quatro cantos de um objeto inclinado, e o sistema "achata" e retifica a imagem para um retângulo perfeito.

---

## 🎯 Funcionalidades Principais

* **Upload Flexível:** Suporte a arrastar e soltar (*Drag and Drop*) ou seleção manual de arquivos (`.png`, `.jpg`, `.jpeg`).
* **Edição Intuitiva:** Interface de edição com 4 pontos de controle grandes, transparentes e responsivos, permitindo a seleção manual dos vértices do objeto a ser corrigido.
* **Correção de Perspectiva (Warp):** Utiliza a matriz de transformação de perspectiva (Homografia 3x3) do **OpenCV.js** para retificar a imagem.
* **Design Adaptável:** A imagem de edição é redimensionada automaticamente para caber inteiramente na tela, centralizada, prevenindo rolagem excessiva.
* **Processamento Client-Side:** Todo o processamento ocorre no navegador, garantindo agilidade e nenhuma dependência de servidor.
* **Download:** Resultado final fornecido com opção de download no formato PNG, mantendo o nome do arquivo original.

---

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Finalidade |
| :--- | :--- |
| **HTML5** | Estrutura da aplicação web. |
| **CSS3 (Tailwind CSS)** | Estilização moderna, responsividade e layout (carregado via CDN). |
| **JavaScript (Vanilla)** | Controle de eventos, lógica de upload e interação com o Canvas. |
| **OpenCV.js** | Biblioteca de Visão Computacional essencial para o cálculo e aplicação da `warpPerspective` (transformação de perspectiva). |
| **HTML Canvas API** | Desenho e manipulação da imagem e dos pontos de controle na tela de edição. |

---

## 🚀 Como Executar o Projeto

Como o projeto é 100% Client-Side, você não precisa de um servidor de backend.

### Opção 1: Abrir Localmente

1.  Clone este repositório para o seu computador.
    ```bash
    git clone https://github.com/gustavoPassone/image-cropper.git
    ```
2.  Abra o arquivo `index.html` diretamente no seu navegador.

### Opção 2: Servidor Local (Recomendado)

O uso de um servidor local simples (como o Live Server do VS Code) é recomendado, pois algumas restrições de segurança do navegador (CORS ou políticas de origem) podem, ocasionalmente, afetar o carregamento de arquivos como o **OpenCV.js** quando abertos diretamente pelo caminho `file://`.

---

## ⚙️ Fluxo de Uso

1.  **Upload:** Arraste e solte uma imagem na área destacada ou use o botão **"Selecionar Arquivo"**.
2.  **Ajuste de Pontos:** A imagem será exibida centralizada. Arraste os quatro pontos de controle (círculos transparentes) para os cantos exatos do objeto (documento) que você deseja retificar.
3.  **Processamento:** Clique no botão **"Finalizar e Corrigir"**.
4.  **Resultado:** A imagem corrigida e perfeitamente retangular aparecerá, pronta para ser baixada.

---

## 🔮 Por Dentro do Processamento

A mágica da correção de perspectiva ocorre no JavaScript, utilizando a API do OpenCV.js:

1.  O aplicativo coleta as coordenadas dos 4 pontos (`srcPoints`) definidos pelo usuário (quadrilátero irregular).
2.  Ele define 4 pontos de destino (`dstPoints`) que formam um retângulo perfeito, com dimensões calculadas para preservar a proporção real do objeto.
3.  A função **`cv.getPerspectiveTransform(srcPoints, dstPoints)`** calcula a matriz de transformação (Homografia).
4.  A função **`cv.warpPerspective()`** aplica essa matriz à imagem original, distorcendo-a e gerando a imagem retificada.
5.  O resultado é exibido no Canvas final para download.

---

## 🧑‍💻 Contribuição

Contribuições são bem-vindas! Se encontrar bugs ou tiver ideias de melhoria, por favor:

1.  Faça um Fork do projeto.
2.  Crie uma branch para sua feature (`git checkout -b feature/minha-melhoria`).
3.  Commit suas mudanças (`git commit -m 'feat: Adiciona nova funcionalidade X'`).
4.  Faça o Push para a branch (`git push origin feature/minha-melhoria`).
5.  Abra um Pull Request.
