import Link from 'next/link'
import { ArrowRight, Brain, Search, Lightbulb, BookOpen } from 'lucide-react'

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
          <Link
            href="/sessions"
            className="text-sm bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
          >
            Bắt đầu
          </Link>
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
        <Link
          href="/sessions"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-lg text-base font-medium hover:opacity-90 transition-opacity"
        >
          Tạo research session đầu tiên
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Brain,
              title: 'Problem Structuring',
              desc: 'Chuẩn hóa vấn đề, trích xuất mâu thuẫn và chuỗi nhân quả',
            },
            {
              icon: Search,
              title: 'Knowledge Retrieval',
              desc: 'Hybrid search trên kho tài liệu TRIZ với citation rõ ràng',
            },
            {
              icon: Lightbulb,
              title: 'Idea Studio',
              desc: 'Sinh candidate solutions và so sánh theo nhiều chiều đánh giá',
            },
            {
              icon: BookOpen,
              title: 'Research Notebook',
              desc: 'Lưu reasoning trail để tái sử dụng và học lại sau này',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-lg p-5">
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
