#
# Copyright (c) 2024–2025, Daily
#
# SPDX-License-Identifier: BSD 2-Clause License
#

"""Pipecat Quickstart Example.

The example runs a simple voice AI bot that you can connect to using your
browser and speak with it.

Required AI services:
- Deepgram (Speech-to-Text)
- Groq (LLM)
- Cartesia (Text-to-Speech)

The example connects between client and server using a P2P WebRTC connection.

Run the bot using::

    python bot.py
"""

import os
import aiohttp
import sqlite3
from dotenv import load_dotenv
from loguru import logger

load_dotenv(override=True)

print("Starting Pipecat bot...")
print("Loading AI models (30-40 seconds first run, <2 seconds after)\n")

logger.info("Loading Silero VAD model...")
from pipecat.audio.vad.silero import SileroVADAnalyzer

logger.info("✅ Silero VAD model loaded")
logger.info("Loading pipeline components...")
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext

from pipecat.processors.frameworks.rtvi import RTVIConfig, RTVIObserver, RTVIProcessor
from pipecat.runner.types import RunnerArguments
from pipecat.services.cartesia.tts import CartesiaTTSService
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.heygen.api_interactive_avatar import NewSessionRequest
from pipecat.services.heygen.video import HeyGenVideoService
from pipecat.transports.base_transport import BaseTransport, TransportParams
from pipecat.transports.network.small_webrtc import SmallWebRTCTransport

logger.info("✅ Pipeline components loaded")

def get_latest_context():
    try:
        db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "learning_notes.db"))
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("SELECT material_text FROM tutor_context ORDER BY updated_at DESC LIMIT 1")
        row = c.fetchone()
        conn.close()
        if row and row[0]:
            return row[0]
    except Exception as e:
        logger.error(f"Error fetching context: {e}")
    return ""

async def run_bot(transport, runner_args: RunnerArguments):
    stt = DeepgramSTTService(api_key=os.getenv("DEEPGRAM_API_KEY"))

    tts = CartesiaTTSService(
        api_key=os.getenv("CARTESIA_API_KEY"),
        voice_id="71a7ad14-091c-4e8e-a314-022ece01c121",  # British Reading Lady
    )

    llm = OpenAILLMService(
        api_key=os.getenv("GROQ_API_KEY"),
        model="llama-3.3-70b-versatile",
        base_url="https://api.groq.com/openai/v1",
    )

    context_text = get_latest_context()
    
    # Truncate context to avoid Groq's TPM rate limit
    # 5000 characters is roughly 1250 tokens, giving us many conversation turns before hitting the 12k TPM limit
    if context_text and len(context_text) > 5000:
        context_text = context_text[:5000] + "\n...[Content truncated due to size limits]..."
    
    system_prompt = (
        "You are a friendly and versatile academic tutor. "
        "Your goal is to help students learn about any topic they are interested in. "
        "Keep responses conversational, concise (1-3 sentences), and encouraging. "
        "After explaining a concept or answering a question, always end with a simple follow-up question to check understanding or guide the conversation further. "
        "If the student answers correctly, provide positive reinforcement and continue the lesson. "
        "If they are confused or wrong, explain the concept again in even simpler terms."
    )
    
    if context_text:
        system_prompt += f"\n\nIMPORTANT CONTEXT:\nThe student has provided the following study material. Use this material as your primary source of truth. If the student asks a question related to it, answer strictly based on this material. Here is the material:\n{context_text}"
        initial_greeting = "Hello! I'm your AI tutor. I have reviewed your study material. What would you like to explore or learn about today?"
    else:
        initial_greeting = "Hello! I'm your AI tutor. What would you like to explore or learn about today?"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "assistant", "content": initial_greeting}
    ]

    context = OpenAILLMContext(messages)
    context_aggregator = llm.create_context_aggregator(context)

    rtvi = RTVIProcessor(config=RTVIConfig(config=[]))

    async with aiohttp.ClientSession() as session:
        logger.info("Starting HeyGen session...")
        heygen = HeyGenVideoService(
            api_key=os.getenv("HEYGEN_API_KEY"),
            session=session,
            session_request=NewSessionRequest(avatar_id="Diora_public_2")
        )

        logger.info("HeyGen service initialized")
        pipeline = Pipeline(
            [
                transport.input(),  # Transport user input
                rtvi,  # RTVI processor
                stt,
                context_aggregator.user(),  # User responses
                llm,  # LLM
                tts,  # TTS
                heygen,
                transport.output(),  # Transport bot output
                context_aggregator.assistant(),  # Assistant spoken responses
            ]
        )

        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True,
                report_only_initial_ttfb=True,
            ),
        )

        rtvi_observer = rtvi.create_rtvi_observer()
        task.add_observer(rtvi_observer)

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(transport, client):
            logger.info(f"Client disconnected")
            await task.cancel()

        runner = PipelineRunner(handle_sigint=False)
        logger.info("Running pipeline...")
        await runner.run(task)

async def bot(runner_args: RunnerArguments):
    transport = SmallWebRTCTransport(
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            video_out_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
        ),
        webrtc_connection=runner_args.webrtc_connection,
    )
    await run_bot(transport, runner_args)

if __name__ == "__main__":
    from pipecat.runner.run import main
    main()
