import React from "react";
import { CorrectionWorkflow } from "../App"

export const CorrectionPanel = () => {

    const [state, setState] = React.useState({
        folder: null,
        total: 0,
        completed: 0,
        currentIndex: -1,
        currentImageName: "",
        running: false,
        processing: false,
        currentResult: null,
        progress: 0
    });
    console.log("CorrectionPanel state:");

    const workflowRef = React.useRef(null);


    React.useEffect(() => {

        workflowRef.current =
            new CorrectionWorkflow(setState);

        return () => {

            if (workflowRef.current) {
                workflowRef.current.stop();
            }

        };

    }, []);


    const start = async () => {

        if (!workflowRef.current) {
            return;
        }

        await workflowRef.current.start();

    };


    const stop = async () => {

        if (!workflowRef.current) {
            return;
        }

        await workflowRef.current.stop();

    };


    return (
        <div className="ce-app">

            {/* HEADER */}

            <div className="ce-header">

                <div>
                    <div className="ce-title">
                        CORRECTION ENGINE
                    </div>

                    <div className="ce-subtitle">
                        Face-Anchored Light Correction
                    </div>
                </div>

                <div className="ce-version">
                    v1.0.0
                </div>

            </div>


            {/* FOLDER */}

            <div className="ce-section">

                <div className="ce-section-title">
                    SOURCE FOLDER
                </div>

                <button
                    className="ce-folder-button"
                    onClick={start}
                    disabled={state.running}
                >
                    {state.running
                        ? "PROCESSING..."
                        : "SELECT IMAGE FOLDER"
                    }
                </button>


                {state.folder && (
                    <div className="ce-folder-info">

                        <div className="ce-folder-name">
                            {state.folder.name}
                        </div>

                        <div className="ce-folder-path">
                            {state.total} images found
                        </div>

                    </div>
                )}

            </div>


            {/* IMAGE SUMMARY */}

            <div className="ce-section">

                <div className="ce-section-title">
                    IMAGE SUMMARY
                </div>

                <div className="ce-stats">

                    <div className="ce-stat">

                        <div className="ce-stat-value">
                            {state.total}
                        </div>

                        <div className="ce-stat-label">
                            TOTAL
                        </div>

                    </div>


                    <div className="ce-stat">

                        <div className="ce-stat-value">
                            {state.completed}
                        </div>

                        <div className="ce-stat-label">
                            COMPLETED
                        </div>

                    </div>


                    <div className="ce-stat">

                        <div className="ce-stat-value">
                            {Math.max(
                                state.total - state.completed,
                                0
                            )}
                        </div>

                        <div className="ce-stat-label">
                            REMAINING
                        </div>

                    </div>

                </div>

            </div>


            {/* CURRENT IMAGE */}

            {state.currentImageName && (

                <div className="ce-section">

                    <div className="ce-section-title">
                        CURRENT IMAGE
                    </div>

                    <div className="ce-current-image">

                        <div className="ce-current-label">
                            PROCESSING
                        </div>

                        <div className="ce-current-name">
                            {state.currentImageName}
                        </div>

                    </div>

                </div>

            )}


            {/* PROGRESS */}

            <div className="ce-section">

                <div className="ce-progress-header">

                    <div className="ce-section-title">
                        PROGRESS
                    </div>

                    <div className="ce-progress-percent">
                        {state.progress}%
                    </div>

                </div>


                <div className="ce-progress-track">

                    <div
                        className="ce-progress-fill"
                        style={{
                            width: `${state.progress}%`
                        }}
                    />

                </div>


                <div className="ce-progress-details">

                    <span>
                        {state.completed} of {state.total}
                    </span>

                    <span>
                        {Math.max(
                            state.total - state.completed,
                            0
                        )} remaining
                    </span>

                </div>

            </div>


            {/* FACE RESULT */}

            {state.currentResult && (

                <div className="ce-section">

                    <div className="ce-section-title">
                        FACE SAMPLING
                    </div>

                    <div className="ce-face-card">

                        <div>
                            Faces detected:{" "}
                            <strong>
                                {state.currentResult.faces?.length || 0}
                            </strong>
                        </div>

                    </div>

                </div>

            )}


            {/* CONTROL */}

            {state.running && (

                <div className="ce-section">

                    <button
                        className="ce-process-button"
                        onClick={stop}
                    >
                        STOP
                    </button>

                </div>

            )}


            {/* STATUS */}

            <div className="ce-status">

                <div className="ce-status-dot" />
               
                <div className="ce-status-text">

                    {!state.folder
                        ? "Waiting for image folder"
                        : !state.running && state.completed === state.total
                            ? "All images completed"
                            : state.processing
                                ? `Processing ${state.currentIndex + 1} of ${state.total}`
                                : "Ready"
                    }

                </div>

            </div>

        </div>
    );
};