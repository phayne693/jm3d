import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes, Sparkles, Lightbulb, Archive, Package, Printer, Wrench, Cog,
  ShieldCheck, Cpu, Truck, Headset, MessageCircle, BookOpen, Star,
  Instagram, Youtube, Music2, ArrowRight, Check,
} from "lucide-react";
import heroImg from "@/assets/hero-printer.jpg";
import logo from "@/assets/jm3d-logo.svg";
import pLightbox from "@/assets/prod-lightbox.jpg";
import pPs5 from "@/assets/prod-ps5.jpg";
import pOrg from "@/assets/prod-organizer.jpg";
import pHead from "@/assets/prod-headphone.jpg";
import pCards from "@/assets/prod-cards.jpg";
import pFil from "@/assets/prod-filament.jpg";
import pCre from "@/assets/prod-creality.jpg";
import g1 from "@/assets/gal-1.jpg";
import g2 from "@/assets/gal-2.jpg";
import g3 from "@/assets/gal-3.jpg";
import g4 from "@/assets/gal-4.jpg";
import g5 from "@/assets/gal-5.jpg";
import g6 from "@/assets/gal-6.jpg";
import aboutPiece from "@/assets/about-piece.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

const WHATSAPP = "https://wa.me/5511940677064?text=Ol%C3%A1%20JM3D%2C%20quero%20um%20or%C3%A7amento";

const nav = [
  { label: "Início", href: "#inicio" },
  { label: "Serviços", href: "#servicos" },
  { label: "Produtos", href: "#produtos" },
  { label: "Como Funciona", href: "#como-funciona" },
  { label: "Galeria", href: "#galeria" },
  { label: "Sobre", href: "#sobre" },
  { label: "Contato", href: "#contato" },
];

const benefits = [
  { icon: ShieldCheck, title: "Alta Qualidade", desc: "Acabamento Premium" },
  { icon: Cpu, title: "Tecnologia de Ponta", desc: "Impressoras de última geração" },
  { icon: Truck, title: "Entrega Rápida", desc: "Para todo o Brasil" },
  { icon: Headset, title: "Atendimento", desc: "Especializado" },
];

const services = [
  { icon: Boxes, title: "Impressão 3D Sob Demanda", desc: "Peças sob medida com alta precisão" },
  { icon: Sparkles, title: "Produtos Personalizados", desc: "Criações exclusivas para você" },
  { icon: Lightbulb, title: "Light Boxes Personalizadas", desc: "Decore com luz e criatividade" },
  { icon: Archive, title: "Organizadores e Decoração", desc: "Organize e decore com estilo" },
  { icon: Package, title: "Venda de Filamentos", desc: "PLA, PETG, ABS e muito mais" },
  { icon: Printer, title: "Venda de Impressoras 3D", desc: "As melhores marcas do mercado" },
  { icon: Cog, title: "Desenvolvimento de Protótipos", desc: "Transforme ideias em realidade" },
  { icon: Wrench, title: "Manutenção e Consultoria", desc: "Suporte técnico especializado" },
];

const products = [
  { img: pLightbox, name: "Light Box Gamer", price: "R$ 149,90" },
  { img: pPs5, name: "Porta Controle PS5", price: "R$ 49,90" },
  { img: pOrg, name: "Organizador de Mesa", price: "R$ 59,90" },
  { img: pHead, name: "Porta Fone", price: "R$ 39,90" },
  { img: pCards, name: "Case para Cartas", price: "R$ 39,90" },
  { img: pFil, name: "Filamento PLA", price: "A partir de R$ 69,90" },
  { img: pCre, name: "Impressora 3D Creality", price: "A partir de R$ 1.499,00" },
];

const steps = [
  { n: 1, title: "Cliente envia a ideia", desc: "Você nos conta o que precisa criar." },
  { n: 2, title: "Modelagem e preparação", desc: "Desenvolvemos o modelo 3D e preparamos para impressão." },
  { n: 3, title: "Impressão 3D", desc: "Utilizamos tecnologia de ponta para imprimir sua peça." },
  { n: 4, title: "Acabamento", desc: "Fazemos o acabamento para um resultado perfeito." },
  { n: 5, title: "Entrega", desc: "Enviamos para você com segurança e rapidez." },
];

const gallery = [g1, g2, g3, g4, g5, g6];

const testimonials = [
  { name: "Lucas R.", text: "Trabalho incrível! Superou minhas expectativas. Qualidade impecável e entrega rápida!" },
  { name: "Mariana S.", text: "Fiz minha light box personalizada e ficou perfeita! Recomendo demais a JM3D." },
  { name: "Carlos T.", text: "Atendimento excelente e produtos de altíssima qualidade. Voltarei a comprar com certeza!" },
];

function Logo({ className = "h-14 w-auto object-contain"}: { className?: string }) {
  return <img src={logo} alt="JM3D" className={className} loading="eager" />;
}

function Header() {
  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-[1600px] px-6 mt-4">

        {/* CONTAINER */}
        <div className="flex items-center gap-8">

          {/* LOGO */}
          <a
            href="#inicio"
            className="
              hidden
              lg:flex

              items-center
              justify-center

              shrink-0

              rounded-[28px]

              backdrop-blur-2xl
              bg-background/20

              border
              border-primary/20

              px-6
              py-5

              shadow-[0_0_45px_rgba(0,140,255,0.18)]

              transition-all
              duration-300

              hover:scale-[1.02]
            "
          >
            <Logo
              className="
                h-28
                w-auto
                object-contain

                drop-shadow-[0_0_30px_rgba(0,140,255,0.55)]
              "
            />
          </a>

          {/* NAVBAR */}
          <div
            className="
              glass

              flex-1

              rounded-2xl

              px-8
              py-4

              flex
              items-center
              justify-between

              backdrop-blur-xl

              border
              border-primary/10
            "
          >

            {/* MENU */}
            <nav className="hidden lg:flex items-center gap-10 text-sm text-muted-foreground">
              {nav.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="
                    hover:text-foreground
                    transition-colors
                    whitespace-nowrap
                  "
                >
                  {n.label}
                </a>
              ))}
            </nav>

            {/* CTA */}
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="
                hidden
                sm:inline-flex

                items-center
                gap-2

                rounded-xl

                border
                border-primary/40

                bg-primary/10

                px-5
                py-2.5

                text-sm
                font-medium

                text-foreground

                hover:bg-primary/20
                hover:border-primary

                glow-border
                transition
              "
            >
              <MessageCircle className="h-4 w-4 text-primary" />
              Solicitar Orçamento
            </a>

          </div>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="inicio" className="relative pt-48 pb-20 bg-hero overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="animate-fade-up">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05] tracking-tight">
            Impressão 3D{" "}
            <span className="text-gradient">Profissional</span> e{" "}
            <span className="text-gradient">Produtos Personalizados</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Criamos peças únicas, decoração personalizada, light boxes, organizadores, protótipos e muito mais.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a href={WHATSAPP} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground hover:opacity-90 glow-strong transition">
              <MessageCircle className="h-5 w-5" /> Solicitar Orçamento
            </a>
            <a href="#produtos"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/60 px-6 py-3 font-semibold hover:border-primary/60 transition">
              <BookOpen className="h-5 w-5" /> Ver Catálogo
            </a>
          </div>
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {benefits.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-lg glass flex items-center justify-center text-primary">
                  <b.icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{b.title}</div>
                  <div className="text-xs text-muted-foreground">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative animate-fade-up">
          <div className="absolute -inset-6 bg-primary/20 blur-3xl rounded-full" aria-hidden />
          <div className="relative rounded-3xl overflow-hidden border border-primary/30 glow-strong">
            <img src={heroImg} alt="Impressora 3D imprimindo vaso geométrico azul" width={1280} height={1024} className="w-full h-auto" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="servicos" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Nossos <span className="text-gradient">Serviços</span>
          </h2>
          <p className="mt-2 text-muted-foreground">Soluções completas em impressão 3D e fabricação digital</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {services.map((s) => (
            <div key={s.title} className="glass hover-glow rounded-2xl p-5 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-4">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Products() {
  return (
    <section id="produtos" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Produtos em <span className="text-gradient">Destaque</span>
            </h2>
            <p className="mt-2 text-muted-foreground">Confira alguns dos nossos produtos mais vendidos</p>
          </div>
          <a href="#galeria" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
            Ver catálogo completo <ArrowRight className="h-4 w-4" />
          </a>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {products.map((p) => (
            <div key={p.name} className="glass hover-glow rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-square overflow-hidden bg-surface">
                <img src={p.img} alt={p.name} loading="lazy" width={640} height={640}
                  className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-sm font-semibold leading-tight">{p.name}</h3>
                <div className="text-xs text-muted-foreground mt-1 mb-3">{p.price}</div>
                <a href={WHATSAPP} target="_blank" rel="noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary/15 border border-primary/40 text-xs py-2 hover:bg-primary/25 transition">
                  <MessageCircle className="h-3.5 w-3.5 text-primary" /> Comprar no WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="como-funciona" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold">
            Como <span className="text-gradient">Funciona</span>
          </h2>
          <p className="mt-2 text-muted-foreground">Simples, rápido e eficiente</p>
        </div>
        <div className="relative">
          <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {steps.map((s) => (
              <div key={s.n} className="relative text-center">
                <div className="mx-auto relative h-16 w-16 rounded-full bg-card border border-primary/40 flex items-center justify-center text-2xl font-bold text-gradient glow-border mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-sm mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section id="galeria" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold">Galeria</h2>
          <p className="mt-2 text-muted-foreground">Veja alguns dos nossos trabalhos</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {gallery.map((src, i) => (
            <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-border hover:border-primary/60 transition">
              <img src={src} alt={`Trabalho JM3D ${i + 1}`} loading="lazy" width={640} height={640}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/15 transition" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="sobre" className="py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 flex justify-center">{/* mx-auto justify-center max-w-7xl px-4 sm:px-6 grid lg:grid-cols-2 gap-6 */}
        <div className="glass rounded-3xl p-8 lg:p-10">
          <h2 className="text-3xl font-bold mb-2">Sobre a JM3D</h2>
          <Logo className="h-12 my-6" />
          <p className="text-muted-foreground leading-relaxed">
            A JM3D é especializada em impressão 3D, fabricação digital e criação de produtos personalizados.
            Trabalhamos com tecnologia de ponta para transformar ideias em produtos reais com qualidade profissional.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {["Qualidade Premium", "Atendimento Personalizado", "Paixão por Inovar"].map((t) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs">
                <Check className="h-3.5 w-3.5 text-primary" /> {t}
              </span>
            ))}
          </div>
          <div className="absolute" />
        </div>
        {/*<div className="glass rounded-3xl p-8 lg:p-10">
          <h2 className="text-3xl font-bold mb-6">
            O que nossos <span className="text-gradient">clientes dizem</span>
          </h2>
          <div className="grid sm:grid-cols-1 gap-4">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-border bg-background/40 p-5">
                <div className="flex gap-0.5 mb-2 text-yellow-400">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                </div>
                <p className="text-sm text-muted-foreground mb-3">"{t.text}"</p>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold">
                    {t.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>*/}
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 mt-6">
        <div className="glass rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8">
          <img src={aboutPiece} alt="Peça geométrica impressa em 3D" loading="lazy" width={640} height={640}
            className="w-40 h-40 object-cover rounded-2xl border border-primary/30 animate-float" />
          <p className="text-muted-foreground">
            Cada peça é tratada com o cuidado e a precisão que sua ideia merece. Da modelagem 3D ao acabamento final,
            entregamos resultados que impressionam.
          </p>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section id="contato" className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden glass rounded-3xl p-10 md:p-16 grid lg:grid-cols-2 items-center gap-8 glow-strong">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/30 blur-3xl" aria-hidden />
          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              Pronto para criar algo <span className="text-gradient">incrível?</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Fale com a JM3D e transforme sua ideia em realidade.
            </p>
            <a href={WHATSAPP} target="_blank" rel="noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-semibold text-primary-foreground hover:opacity-90 glow-strong transition">
              <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
            </a>
          </div>
          <div className="relative flex justify-center">
            <img src={aboutPiece} alt="" loading="lazy" width={400} height={400}
              className="w-72 h-72 object-cover rounded-full border border-primary/40 animate-float opacity-90" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {

  const socials = [
    {
      icon: Instagram,
      href: "https://instagram.com/jm3d.lab",
      label: "Instagram",
    },
    {
      icon: Music2,
      href: "https://www.tiktok.com/@jm3d",
      label: "TikTok",
    },
    {
      icon: MessageCircle,
      href: "https://wa.me/5511940677064",
      label: "WhatsApp",
    },
    {
      icon: Youtube,
      href: "https://facebook.com/jm3d",
      label: "Facebook",
    },
  ];

  return (
    <footer className="border-t border-border py-12 mt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 grid md:grid-cols-2 lg:grid-cols-5 gap-10">

        {/* BRAND */}
        <div className="lg:col-span-2">
          <Logo className="h-12 mb-4" />

          <p className="text-sm text-muted-foreground max-w-xs">
            Transformando ideias em realidade através da impressão 3D.
          </p>

          {/* SOCIALS */}
          <div className="flex gap-3 mt-5">
            {socials.map((social, i) => {
              const Icon = social.icon;

              return (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={social.label}
                  className="
                    h-11
                    w-11

                    rounded-xl

                    glass

                    flex
                    items-center
                    justify-center

                    text-muted-foreground

                    border
                    border-transparent

                    hover:text-primary
                    hover:border-primary/60

                    hover:scale-110
                    hover:shadow-[0_0_20px_rgba(0,140,255,0.35)]

                    transition-all
                    duration-300
                  "
                >
                  <Icon className="h-5 w-5" />
                </a>
              );
            })}
          </div>
        </div>

        {/* LINKS */}
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-3">
            Links Rápidos
          </div>

          <ul className="space-y-2 text-sm">
            {nav.map((n) => (
              <li key={n.href}>
                <a
                  href={n.href}
                  className="hover:text-primary transition"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* PRODUTOS */}
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-3">
            Produtos
          </div>

          <ul className="space-y-2 text-sm">
            {[
              "Light Boxes",
              "Organizadores",
              "Filamentos",
              "Impressoras 3D",
              "Acessórios",
              "Peças Personalizadas",
            ].map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>

        {/* CONTATO */}
        <div>
          <div className="text-sm font-semibold text-muted-foreground mb-3">
            Atendimento
          </div>

          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>(11) 94067-7064</li>
            <li>(11) 94132-5895</li>
            <li>atendimento@jm3d.com.br</li>
            <li>São Paulo - SP</li>
            <li>Seg a Sex: 09h às 18h</li>
          </ul>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-4 text-xs text-muted-foreground">
        <div>© 2026 JM3D — Todos os direitos reservados.</div>
        <div>Imagine. Crie. Imprima.</div>
      </div>
    </footer>
  );
}

function FloatingWhats() {
  return (
    <a href={WHATSAPP} target="_blank" rel="noreferrer" aria-label="WhatsApp"
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-green-500 text-white shadow-2xl flex items-center justify-center hover:scale-110 transition">
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}

function Index() {
  return (
    <div className="dark min-h-screen">
      <Header />
      <main>
        <Hero />
        <Services />
        <Products />
        <HowItWorks />
        <Gallery />
        <About />
        <CTA />
      </main>
      <Footer />
      <FloatingWhats />
    </div>
  );
}
