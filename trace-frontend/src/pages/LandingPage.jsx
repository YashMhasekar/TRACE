import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/button'
import { Zap, TrendingUp, Eye, FileSearch, RotateCcw, Target, ArrowRight, CheckCircle2, Moon, Sun, PlayCircle } from 'lucide-react'

export function LandingPage() {
  const { user, loading, signInAsDemo } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleDemo = () => {
    signInAsDemo()
    navigate('/')
  }

  if (!loading && user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div>
                <p className="font-bold text-lg leading-tight tracking-tight text-foreground">TRACE</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Performance Attribution</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Sun className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              <Link to="/login">
                <Button variant="ghost" size="sm">Log In</Button>
              </Link>
              <button
                onClick={handleDemo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-[#615FFF]/40 text-[#615FFF] hover:bg-[#615FFF]/10 transition-colors"
                aria-label="Try demo without signing up"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Try Demo
              </button>
              <Link to="/signup">
                <Button size="sm" className="gap-1.5">
                  Get Started <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-sm font-medium mb-4">
            <Target className="w-4 h-4" />
            Energy Performance Intelligence
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight text-foreground">
            Trace every miss.<br />
            <span className="bg-gradient-to-r from-[#615FFF] to-[#7C86FF] bg-clip-text text-transparent">
              Recover what matters.
            </span>
          </h1>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            TRACE explains why your energy assets missed expected output — and shows you exactly what's recoverable.
          </p>

          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex items-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="gap-2 h-12 px-6">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="h-12 px-6">
                  Log In
                </Button>
              </Link>
            </div>

            {/* Demo access for evaluators */}
            <div className="flex flex-col items-center gap-1.5">
              <button
                onClick={handleDemo}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#615FFF]/15 to-[#7C86FF]/15 border border-[#615FFF]/30 text-[#615FFF] hover:from-[#615FFF]/25 hover:to-[#7C86FF]/25 hover:border-[#615FFF]/50 transition-all duration-200 shadow-sm"
                aria-label="Access demo dashboard instantly without signing up"
              >
                <PlayCircle className="w-4 h-4" />
                Try Live Demo — No Sign-Up Needed
              </button>
              <p className="text-xs text-muted-foreground">Evaluators: instant full access to the dashboard</p>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Flow Diagram */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="relative">
          <div className="grid grid-cols-5 gap-4 items-center">
            {[
              { icon: Target,       label: 'Gap',         color: '#EF4444' },
              { icon: TrendingUp,   label: 'Attribution', color: '#615FFF' },
              { icon: Eye,          label: 'Evidence',    color: '#7C86FF' },
              { icon: RotateCcw,    label: 'Recurrence',  color: '#F59E0B' },
              { icon: CheckCircle2, label: 'Recovery',    color: '#10B981' },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 transition-transform duration-200 hover:scale-105"
                  style={{ background: step.color + '18', border: `1px solid ${step.color}40` }}
                >
                  <step.icon className="w-7 h-7" style={{ color: step.color }} />
                </div>
                <p className="text-sm font-semibold text-foreground">{step.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3 text-foreground">Why Did We Miss?</h2>
          <p className="text-lg text-muted-foreground">
            From performance gap to recovery opportunity in minutes
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: TrendingUp,
              title: 'Multi-Cause Attribution',
              description: 'Decompose performance gaps across resource, equipment, operations, grid, and commercial factors.',
            },
            {
              icon: Eye,
              title: 'Evidence-Backed',
              description: 'Every attribution linked to evidence from meters, SCADA events, weather data, and inspections.',
            },
            {
              icon: FileSearch,
              title: 'Prove It',
              description: 'Visualize the evidence chain from claim to meter reading. Full audit trail.',
            },
            {
              icon: RotateCcw,
              title: 'Recurrence Detection',
              description: 'Identify recurring problems. Prioritize recovery actions by frequency and controllability.',
            },
            {
              icon: Target,
              title: 'Recovery Simulator',
              description: 'Model financial impact of fixing controllable causes. Simulate 0-100% improvement.',
            },
            {
              icon: Zap,
              title: 'AI Investigator',
              description: 'Ask questions about validated evidence. Get structured responses grounded in analytics.',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="rounded-[10px] border border-border bg-card p-6 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-base font-bold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/40 border-y border-border transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { label: 'Solar',   value: '100+ MW',  icon: Target     },
              { label: 'Wind',    value: '150+ MW',  icon: TrendingUp },
              { label: 'Storage', value: '50+ MWh',  icon: Zap        },
            ].map((stat, i) => (
              <div key={i}>
                <stat.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                <p className="text-4xl font-bold text-primary mb-1">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label} Capacity Monitored</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-12 text-center">
          <h2 className="text-3xl font-bold mb-3 text-foreground">
            Ready to Trace Your Performance Gaps?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Start analyzing your energy asset performance with TRACE today.
          </p>
          <Link to="/signup">
            <Button size="lg" className="gap-2 h-12 px-8">
              Get Started <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-sm text-foreground">TRACE</span>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 TRACE · Performance Attribution & Recovery Intelligence
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
