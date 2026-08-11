import sys
from transformers import BlipProcessor, BlipForQuestionAnswering

MODEL_ID = "Salesforce/blip-vqa-base"
print("[*] Downloading VQA Model...")
processor = BlipProcessor.from_pretrained(MODEL_ID)
model = BlipForQuestionAnswering.from_pretrained(MODEL_ID)
print("[+] Download complete!")
