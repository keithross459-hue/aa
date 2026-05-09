"""
Prompt optimization service for FiiLTHY.AI.
Helps users craft better prompts for AI product generation.
"""
import asyncio
from typing import Any, Dict, List, Optional
from services.llm_client import generate_text_with_fallback


class PromptOptimizer:
    """Helps optimize user prompts for better product generation."""
    
    PROMPT_QUALITY_SYSTEM = """You are FiiLTHY.AI's prompt optimization expert.
Your job is to analyze user inputs and suggest better prompts that lead to:
- Clearer product descriptions
- More specific target audiences
- Better value propositions
- More sellable/viral products

Return a structured JSON response with:
{
  "original_prompt": "user's input",
  "issues": ["list of problems with the original prompt"],
  "improved_prompt": "much better version that fixes all issues",
  "key_improvements": ["specific changes that make it better"],
  "tips": ["general tips for future prompts"]
}"""

    PROMPT_EXAMPLES_SYSTEM = """You are FiiLTHY.AI's product prompt generator.
Your job is to create EXAMPLE prompts that lead to viral, sellable digital products.
Return 5 diverse, high-quality product ideas with clear, specific prompts.

Format each as:
1. [PRODUCT TITLE]
   Prompt: "[specific, clear prompt for AI to follow]"
   Why it works: [1-2 sentences explaining why this would be viral/sellable]"""

    @staticmethod
    async def improve_prompt(user_input: str, user_id: str = None, api_key: str = None) -> Dict[str, Any]:
        """
        Analyze and improve a user's product prompt.
        
        Args:
            user_input: The user's raw prompt
            user_id: Optional user ID for logging
            api_key: Optional API key override
            
        Returns:
            Dict with analysis, improved prompt, and tips
        """
        try:
            result = await generate_text_with_fallback(
                system=PromptOptimizer.PROMPT_QUALITY_SYSTEM,
                prompt=f"Analyze this user prompt and suggest improvements:\n\n{user_input}",
                session_id=user_id,
                api_key_override=api_key,
            )
            
            # Parse JSON from result
            import json
            import re
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                try:
                    return json.loads(json_match.group())
                except json.JSONDecodeError:
                    pass
            
            # Fallback if JSON parsing fails
            return {
                "original_prompt": user_input,
                "improved_prompt": result,
                "status": "parsed_as_text"
            }
        except Exception as e:
            return {
                "error": str(e),
                "original_prompt": user_input,
                "improved_prompt": user_input,  # Fallback to original
            }
    
    @staticmethod
    async def generate_prompt_examples(category: str = None, user_id: str = None, api_key: str = None) -> Dict[str, Any]:
        """
        Generate 5 example prompts that lead to good products.
        
        Args:
            category: Optional category (e.g., "business", "wellness", "education")
            user_id: Optional user ID for logging
            api_key: Optional API key override
            
        Returns:
            Dict with example prompts and explanations
        """
        try:
            category_hint = f" in the {category} category" if category else ""
            
            result = await generate_text_with_fallback(
                system=PromptOptimizer.PROMPT_EXAMPLES_SYSTEM,
                prompt=f"Generate 5 high-quality, viral-potential product prompts{category_hint}.",
                session_id=user_id,
                api_key_override=api_key,
            )
            
            return {
                "status": "success",
                "category": category or "general",
                "examples": result,
            }
        except Exception as e:
            return {
                "error": str(e),
                "status": "failed",
            }
    
    @staticmethod
    async def check_prompt_quality(prompt: str) -> Dict[str, Any]:
        """
        Quick quality check of a prompt (no LLM call, just heuristics).
        
        Returns:
        - score (0-100)
        - issues (list of problems)
        - suggestions (list of quick fixes)
        """
        issues = []
        suggestions = []
        score = 100
        
        # Check length
        if len(prompt) < 20:
            issues.append("Prompt too short (less than 20 characters)")
            suggestions.append("Add more specific details about what product you want to create")
            score -= 20
        elif len(prompt) > 500:
            issues.append("Prompt too long (over 500 characters)")
            suggestions.append("Be more concise, focus on key product details")
            score -= 10
        
        # Check specificity
        vague_words = ["good", "nice", "cool", "awesome", "best", "amazing", "great"]
        vague_count = sum(1 for word in vague_words if word in prompt.lower())
        if vague_count > 0:
            issues.append(f"Used {vague_count} vague adjectives instead of specific details")
            suggestions.append("Replace vague words with specific benefits and features")
            score -= vague_count * 5
        
        # Check for target audience
        audience_words = ["course", "template", "checklist", "guide", "toolkit", "framework", "blueprint", "system", "script", "bundle"]
        has_audience = any(word in prompt.lower() for word in audience_words)
        if not has_audience:
            issues.append("No specific product type mentioned")
            suggestions.append("Specify what type of product (course, template, guide, toolkit, etc.)")
            score -= 15
        
        # Check for benefit
        if "for" not in prompt.lower() and "help" not in prompt.lower():
            issues.append("Unclear who this product is for or what problem it solves")
            suggestions.append("Include 'for [target audience]' or explain what problem it solves")
            score -= 20
        
        score = max(0, min(100, score))  # Clamp to 0-100
        
        return {
            "prompt": prompt,
            "quality_score": score,
            "issues": issues,
            "suggestions": suggestions,
            "status": "good" if score >= 70 else "needs_work",
        }


async def improve_user_prompt(prompt: str, user_id: str = None, api_key: str = None) -> Dict[str, Any]:
    """Public API for prompt improvement."""
    return await PromptOptimizer.improve_prompt(prompt, user_id, api_key)


async def get_prompt_inspiration(category: str = None, user_id: str = None, api_key: str = None) -> Dict[str, Any]:
    """Public API for prompt examples."""
    return await PromptOptimizer.generate_prompt_examples(category, user_id, api_key)


def analyze_prompt_quality(prompt: str) -> Dict[str, Any]:
    """Public API for quick quality check."""
    return PromptOptimizer.check_prompt_quality(prompt)
