import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function downloadDocumentAsImage(element: HTMLElement, fileName: string) {
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const link = document.createElement("a");
  link.download = `${fileName}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export async function downloadDocumentAsPdf(element: HTMLElement, fileName: string) {
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  
  const widthRatio = pdfWidth / imgWidth;
  const scaledHeight = imgHeight * widthRatio;

  if (scaledHeight <= pdfHeight) {
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, scaledHeight);
  } else {
    const heightRatio = pdfHeight / imgHeight;
    const scaledWidth = imgWidth * heightRatio;
    const xOffset = (pdfWidth - scaledWidth) / 2;
    pdf.addImage(imgData, "PNG", xOffset, 0, scaledWidth, pdfHeight);
  }

  pdf.save(`${fileName}.pdf`);
}
