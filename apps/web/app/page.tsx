import Link from 'next/link'
import { ArrowRight, Brain, Search, BookOpen, Activity } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg">Creative Research Workbench</span>
          </div>

          <div className="flex items-center gap-6">
            <nav
              aria-label="Điều hướng chính"
              className="hidden md:flex items-center gap-5 text-sm font-medium"
            >
              <Link
                href="/sessions"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Sessions
              </Link>
              <Link
                href="/analytics"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Phân tích
              </Link>
              <Link
                href="/knowledge"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Cơ sở Tri thức
              </Link>
              <Link
                href="/search"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Tìm kiếm
              </Link>
            </nav>

            <Link
              href="/sessions"
              className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
            >
              Bắt đầu
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Biến vấn đề phức tạp thành
          <span className="text-primary"> phương án hành động</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
          Kết hợp tri thức TRIZ với AI workflow — phân tích mâu thuẫn, gợi ý phương pháp, truy xuất case tương tự và lưu lại tiến trình tư duy.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/sessions"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg text-base font-medium hover:opacity-90 transition-opacity"
          >
            Tạo research session đầu tiên
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/analytics"
            className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-6 py-3 rounded-lg text-base font-medium border border-border hover:bg-secondary/80 transition-colors"
          >
            <Activity className="w-4 h-4 text-primary" />
            Xem tổng quan phân tích
          </Link>
        </div>
      </section>

      {/* Features Hub Grid */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Brain,
              title: 'Research Sessions',
              desc: 'Chuẩn hóa vấn đề, trích xuất mâu thuẫn và chuỗi nhân quả',
              href: '/sessions',
            },
            {
              icon: Search,
              title: 'Semantic Search',
              desc: 'Hybrid search trên kho tài liệu TRIZ với citation rõ ràng',
              href: '/search',
            },
            {
              icon: BookOpen,
              title: 'Cơ sở Tri thức',
              desc: 'Kho tài liệu nguồn chuẩn tắc và phân rã các đoạn trích chunks',
              href: '/knowledge',
            },
            {
              icon: Activity,
              title: 'Tổng quan & Phân tích',
              desc: 'Thống kê toàn diện về các phiên nghiên cứu, nội dung và TRIZ',
              href: '/analytics',
            },
          ].map(({ icon: Icon, title, desc, href }) => (
            <Link
              key={title}
              href={href}
              className="bg-card border border-border rounded-lg p-5 hover:border-primary/50 hover:shadow-sm transition-all group block"
            >
              <Icon className="w-8 h-8 text-primary mb-3 group-hover:scale-105 transition-transform" />
              <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
