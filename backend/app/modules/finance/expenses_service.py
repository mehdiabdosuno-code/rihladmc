"""Service for managing field expenses and OCR processing."""

import random
from datetime import datetime
from typing import Dict, Any

class FieldExpenseService:
    @staticmethod
    async def process_receipt_ocr(image_url: str) -> Dict[str, Any]:
        """
        Simulates an AI OCR call to extract data from a receipt image.
        In production, this would call Google Document AI or an LLM with vision.
        """
        # Simulated AI logic
        categories = ["Restaurant", "Péage", "Carburant", "Hébergement Chauffeur", "Frais Divers"]
        
        # Artificial delay to simulate processing
        import asyncio
        await asyncio.sleep(2)
        
        return {
            "merchant": "Station Afriquia Marrakech",
            "total_amount": round(random.uniform(200, 800), 2),
            "vat_amount": 0.0,
            "category": random.choice(categories),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "confidence": 0.94
        }

    @staticmethod
    def approve_expense(expense_id: str, approver_id: str):
        # Logic to update status and link to project budget
        pass
