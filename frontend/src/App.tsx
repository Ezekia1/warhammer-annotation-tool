/**
 * Warhammer 40K Dataset Annotation App
 *
 * Simple app for manually annotating bounding boxes on miniature images.
 * Creates training data for YOLO object detection models.
 */

import ErrorBoundary from './components/ErrorBoundary'
import AnnotationInterface from './components/AnnotationInterface'

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-900">
        <div className="max-w-7xl mx-auto py-8 px-4">
          {/* HEADER */}
          <header className="text-center mb-10">
            <h1 className="text-5xl font-black mb-3 text-amber-500 tracking-wider">
              ⚔️ WARHAMMER 40K ⚔️
            </h1>
            <h2 className="text-3xl font-bold mb-4 text-white">
              DATASET ANNOTATION
            </h2>
            <p className="text-sm text-gray-400 tracking-widest mb-4 opacity-80">
              Manual bbox annotation for YOLO training data
            </p>
            <div className="h-0.5 mx-auto mb-6 w-48 bg-amber-500 opacity-50" />
            <p className="text-base text-gray-300 opacity-90">
              Draw bounding boxes around miniatures to create training data
            </p>
          </header>

          {/* MAIN CONTENT */}
          <main>
            <AnnotationInterface />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  )
}

export default App
