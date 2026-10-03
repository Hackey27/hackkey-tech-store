/** A Back event belongs only to the uppermost active overlay. */
export class DismissibleStack {
  private markers: string[] = [];
  add(marker: string) { if (!this.markers.includes(marker)) this.markers.push(marker); }
  remove(marker: string) { this.markers = this.markers.filter(value => value !== marker); }
  claim(marker: string, destinationMarker?: string): boolean {
    if (this.markers.at(-1) !== marker || destinationMarker === marker) return false;
    this.remove(marker);
    return true;
  }
}
