import React, { useState } from 'react'

const NoContentFound = ({ element }) => {
  return (
    <p>There are no {element} in your library.</p>
  )
}

export default NoContentFound;