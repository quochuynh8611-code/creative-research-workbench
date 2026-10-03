/** @jest-environment jsdom */
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import HomePage from '../page'

describe('HomePage Component (Phase 11.2 Discoverability)', () => {
  // Test 1: Header Navigation Links
  it('renders_header_navigation_links_to_core_modules', () => {
    render(<HomePage />)

    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()

    // Header Links
    const sessionsLink = within(header).getByRole('link', { name: /sessions/i })
    expect(sessionsLink).toHaveAttribute('href', '/sessions')

    const analyticsLink = within(header).getByRole('link', { name: /phân tích/i })
    expect(analyticsLink).toHaveAttribute('href', '/analytics')

    const knowledgeLink = within(header).getByRole('link', { name: /cơ sở tri thức/i })
    expect(knowledgeLink).toHaveAttribute('href', '/knowledge')

    const searchLink = within(header).getByRole('link', { name: /tìm kiếm/i })
    expect(searchLink).toHaveAttribute('href', '/search')

    const startCta = within(header).getByRole('link', { name: /bắt đầu/i })
    expect(startCta).toHaveAttribute('href', '/sessions')
  })

  // Test 2: Hero Section CTAs
  it('renders_hero_primary_and_secondary_calls_to_action', () => {
    render(<HomePage />)

    const primaryHeroCta = screen.getByRole('link', { name: /tạo research session/i })
    expect(primaryHeroCta).toHaveAttribute('href', '/sessions')

    const secondaryHeroCta = screen.getByRole('link', { name: /xem tổng quan phân tích/i })
    expect(secondaryHeroCta).toHaveAttribute('href', '/analytics')
  })

  // Test 3: Clickable Hub Cards for Core Routes
  it('renders_clickable_home_hub_cards_for_core_routes', () => {
    render(<HomePage />)

    // All 4 key destinations must be present as links on the home page
    const allLinks = screen.getAllByRole('link')
    const hrefs = allLinks.map((link) => link.getAttribute('href'))

    expect(hrefs).toContain('/sessions')
    expect(hrefs).toContain('/analytics')
    expect(hrefs).toContain('/knowledge')
    expect(hrefs).toContain('/search')
  })
})
