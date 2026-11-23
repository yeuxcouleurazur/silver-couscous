/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DotBrainWorkspace } from './components/DotBrainWorkspace';

export default function App() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <DotBrainWorkspace
        isDemoMode
        enableDemoSimulation
        initialLayoutMode="brain"
      />
    </div>
  );
}
