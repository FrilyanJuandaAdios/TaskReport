import * as React from 'react'

const LAUNCH_DURATION_MS = 2300

export function LaunchScreen() {
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), LAUNCH_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="launch-screen" aria-hidden="true">
      <div className="launch-glow" />
      <div className="launch-brand">
        <img className="launch-logo" src="/Taskqueue.png" alt="" />
        <div className="launch-copy">
          <span className="launch-wordmark">Taskqueue</span>
          <span className="launch-byline">by Frilyan design</span>
        </div>
      </div>
      <div className="launch-progress"><span /></div>
    </div>
  )
}
