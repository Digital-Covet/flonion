import type { Component } from 'solid-js'
import type { PageHeaderData } from '../../types'

const PageHeader: Component<PageHeaderData> = (props) => {
  return (
    <header class="mb-8">
      <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
        {props.title}
      </h1>
      <p class="text-slate-500 mt-1 text-lg">
        {props.subtitle}
      </p>
    </header>
  )
}
export default PageHeader
