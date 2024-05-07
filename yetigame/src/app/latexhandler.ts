import { mathjax } from 'mathjax-full/js/mathjax'
import { TeX } from 'mathjax-full/js/input/tex'
import { SVG } from 'mathjax-full/js/output/svg'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

const mathjax_document = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax:  new SVG({ fontCache: 'local' })
})

const mathjax_options = {
  em: 16,
  ex: 8,
  containerWidth: 1280,
}

export function get_mathjax_svg(math: string): string {
  const node = mathjax_document.convert(math, mathjax_options)
  return adaptor.innerHTML(node);
}

export function renderLatex(latexText: string){
    const node = mathjax_document.convert(latexText)
    return 'data:image/svg+xml;base64,' + btoa('<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n' + adaptor.innerHTML(node));

}
