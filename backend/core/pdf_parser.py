import base64
import re
import zlib
import zipfile
import io
import xml.etree.ElementTree as ET


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """
    Pure-Python PDF text extractor that decompresses FlateDecode streams
    and extracts text blocks (Tj / TJ operators) when external C libraries are absent.
    """
    extracted_chunks: list[str] = []

    # Find all stream...endstream blocks
    stream_pattern = re.compile(rb"stream[\r\n]+(.*?)[\r\n]+endstream", re.DOTALL)
    for match in stream_pattern.finditer(pdf_bytes):
        raw_stream = match.group(1)
        decompressed = None
        for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
            try:
                decompressed = zlib.decompress(raw_stream, wbits)
                break
            except Exception:
                continue
        if decompressed is None:
            decompressed = raw_stream

        try:
            text_data = decompressed.decode("latin-1", errors="ignore")
        except Exception:
            continue

        # Extract literal strings inside parentheses (...) used by Tj and TJ
        for lit in re.finditer(r"\(([^()\\]*(?:\\.[^()\\]*)*)\)", text_data):
            token = lit.group(1)
            token = (
                token.replace(r"\n", "\n")
                .replace(r"\r", " ")
                .replace(r"\t", " ")
                .replace(r"\(", "(")
                .replace(r"\)", ")")
                .replace(r"\\", "\\")
            )
            cleaned = "".join(ch for ch in token if ch.isprintable() or ch in "\n\t ")
            if cleaned.strip():
                extracted_chunks.append(cleaned)

    joined = " ".join(extracted_chunks)
    joined = re.sub(r"\s+", " ", joined).strip()
    return joined


def extract_text_from_docx_bytes(docx_bytes: bytes) -> str:
    """Pure-Python .docx XML text extractor."""
    try:
        with zipfile.ZipFile(io.BytesIO(docx_bytes)) as zf:
            xml_content = zf.read("word/document.xml")
        tree = ET.fromstring(xml_content)
        paragraphs: list[str] = []
        for elem in tree.iter():
            if elem.tag.endswith("}t") and elem.text:
                paragraphs.append(elem.text)
            elif elem.tag.endswith("}p"):
                paragraphs.append("\n")
        return re.sub(r"\n{3,}", "\n\n", "".join(paragraphs)).strip()
    except Exception:
        return ""


def parse_uploaded_document(filename: str, content_base64: str) -> dict:
    """Decodes an uploaded base64 document (.pdf, .docx, .txt, .md) into clean text."""
    raw_bytes = base64.b64decode(content_base64)
    lower_name = (filename or "document.txt").lower()

    if lower_name.endswith(".pdf"):
        text = extract_text_from_pdf_bytes(raw_bytes)
    elif lower_name.endswith(".docx"):
        text = extract_text_from_docx_bytes(raw_bytes)
    else:
        text = raw_bytes.decode("utf-8", errors="ignore")

    return {
        "filename": filename,
        "text": text.strip(),
        "char_count": len(text.strip()),
    }

