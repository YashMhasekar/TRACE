"""
run_pipeline.py — TRACE Data Pipeline Orchestration

Master script to execute the entire TRACE data pipeline in correct order.

Usage:
    python run_pipeline.py

This script:
1. Validates prerequisites
2. Executes all pipeline scripts in dependency order
3. Reports success/failure for each step
4. Provides final integrity check results
"""

import subprocess
import sys
import time
from pathlib import Path

# Pipeline scripts in correct execution order
PIPELINE_STEPS = [
    {
        "name": "Physical Data Processing",
        "script": "process_physical_data.py",
        "description": "Load and preprocess raw PVDAQ data",
    },
    {
        "name": "Expected Generation Model",
        "script": "build_expected_model.py",
        "description": "Train expected generation model and predict",
    },
    {
        "name": "Data Quality Guard",
        "script": "add_data_quality_guard.py",
        "description": "Add measurement quality flags",
    },
    {
        "name": "Attribution Engine",
        "script": "build_attribution_engine.py",
        "description": "Build evidence-weighted attribution",
    },
    {
        "name": "Episode Attribution",
        "script": "build_episode_attribution.py",
        "description": "Aggregate attribution into episodes",
    },
    {
        "name": "Recurrence Engine",
        "script": "build_recurrence_engine.py",
        "description": "Analyze recurrence patterns",
    },
    {
        "name": "Decision Engine",
        "script": "build_decision_engine.py",
        "description": "Build decision intelligence layer",
    },
    {
        "name": "Evidence Chain",
        "script": "build_evidence_chain.py",
        "description": "Create evidence & proof chains",
    },
    {
        "name": "Commercial Layer",
        "script": "build_commercial_layer.py",
        "description": "Calculate financial impact",
    },
    {
        "name": "Recovery Reconciliation",
        "script": "build_recovery_reconciliation.py",
        "description": "Reconcile recovery opportunities",
    },
    {
        "name": "Event Dataset",
        "script": "create_event_dataset.py",
        "description": "Create event evidence dataset",
    },
    {
        "name": "Integrity Check",
        "script": "build_integrity_check.py",
        "description": "Validate data integrity",
    },
]


def print_header(text):
    """Print formatted section header."""
    print()
    print("=" * 70)
    print(text)
    print("=" * 70)
    print()


def print_step(step_num, total_steps, name):
    """Print step header."""
    print()
    print(f"[{step_num}/{total_steps}] {name}")
    print("-" * 70)


def run_script(script_path):
    """Run a Python script and return success status."""
    try:
        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout per script
        )
        
        if result.returncode == 0:
            return True, result.stdout
        else:
            return False, result.stderr
            
    except subprocess.TimeoutExpired:
        return False, "Script timeout (5 minutes exceeded)"
    except Exception as e:
        return False, str(e)


def check_prerequisites():
    """Check if necessary files and directories exist."""
    print_header("TRACE DATA PIPELINE - PREREQUISITE CHECK")
    
    # Check config file
    config_path = Path(__file__).parent / "config.py"
    if not config_path.exists():
        print("❌ ERROR: config.py not found")
        return False
    print("✓ config.py found")
    
    # Check raw data directory
    from config import RAW_DATA_DIR
    if not RAW_DATA_DIR.exists():
        print(f"❌ ERROR: Raw data directory not found: {RAW_DATA_DIR}")
        return False
    
    raw_files = list(RAW_DATA_DIR.glob("*.csv"))
    if len(raw_files) == 0:
        print(f"❌ ERROR: No CSV files found in {RAW_DATA_DIR}")
        return False
    
    print(f"✓ Raw data directory found: {RAW_DATA_DIR}")
    print(f"✓ Found {len(raw_files)} raw CSV files")
    
    # Check processed directory exists or can be created
    from config import PROCESSED_DATA_DIR, ensure_output_dir
    try:
        ensure_output_dir()
        print(f"✓ Processed data directory ready: {PROCESSED_DATA_DIR}")
    except Exception as e:
        print(f"❌ ERROR: Cannot create processed directory: {e}")
        return False
    
    print()
    print("All prerequisites met. Ready to run pipeline.")
    return True


def main():
    """Execute the complete TRACE data pipeline."""
    
    print_header("TRACE DATA PIPELINE ORCHESTRATION")
    print("This script will execute all pipeline scripts in correct order.")
    print("Pipeline Steps:", len(PIPELINE_STEPS))
    print()
    
    # Check prerequisites
    if not check_prerequisites():
        print()
        print("❌ Prerequisites not met. Please fix errors and try again.")
        sys.exit(1)
    
    # Track results
    results = []
    start_time = time.time()
    
    # Execute pipeline
    print_header("EXECUTING PIPELINE")
    
    script_dir = Path(__file__).parent
    
    for i, step in enumerate(PIPELINE_STEPS, 1):
        print_step(i, len(PIPELINE_STEPS), step["name"])
        print(f"Description: {step['description']}")
        print(f"Script: {step['script']}")
        print()
        
        script_path = script_dir / step["script"]
        
        if not script_path.exists():
            print(f"❌ ERROR: Script not found: {script_path}")
            results.append({
                "step": step["name"],
                "success": False,
                "message": "Script file not found",
            })
            continue
        
        step_start = time.time()
        success, output = run_script(script_path)
        step_duration = time.time() - step_start
        
        if success:
            print(f"✓ SUCCESS ({step_duration:.1f}s)")
            results.append({
                "step": step["name"],
                "success": True,
                "message": "Completed successfully",
                "duration": step_duration,
            })
        else:
            print(f"❌ FAILED ({step_duration:.1f}s)")
            print()
            print("Error output:")
            print(output[:500])  # Print first 500 chars of error
            results.append({
                "step": step["name"],
                "success": False,
                "message": output[:200],
                "duration": step_duration,
            })
            
            # Ask if user wants to continue
            print()
            response = input("Continue with remaining steps? (y/n): ")
            if response.lower() != 'y':
                print("Pipeline execution stopped by user.")
                break
    
    # Summary
    total_duration = time.time() - start_time
    
    print_header("PIPELINE EXECUTION SUMMARY")
    
    successful = sum(1 for r in results if r["success"])
    failed = len(results) - successful
    
    print(f"Total Steps:     {len(results)}")
    print(f"Successful:      {successful}")
    print(f"Failed:          {failed}")
    print(f"Total Duration:  {total_duration:.1f}s")
    print()
    
    print("STEP RESULTS:")
    print("-" * 70)
    for result in results:
        status = "✓" if result["success"] else "❌"
        duration = f"{result.get('duration', 0):.1f}s" if result.get('duration') else "N/A"
        print(f"{status} {result['step']:40s} [{duration:>7s}]")
    
    print()
    
    if failed == 0:
        print("=" * 70)
        print("✓ PIPELINE COMPLETED SUCCESSFULLY")
        print("=" * 70)
        print()
        print("Next steps:")
        print("1. Review the processed data in the 'processed/' directory")
        print("2. Check the integrity report: trace_integrity_report.csv")
        print("3. Start the FastAPI backend to serve the data")
        print()
        return 0
    else:
        print("=" * 70)
        print("❌ PIPELINE COMPLETED WITH ERRORS")
        print("=" * 70)
        print()
        print("Some steps failed. Review the error messages above.")
        print("You may need to fix issues and re-run the pipeline.")
        print()
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print()
        print()
        print("Pipeline execution interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print()
        print(f"❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
