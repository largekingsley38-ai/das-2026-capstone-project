// One box in the chain: holds a person and points to the next box
class WaitlistNode {
  constructor(person) {
    this.person = person;
    this.next = null;
  }
}

// First in, first out line
class Waitlist {
  constructor() {
    this.head = null; // front of the line
    this.tail = null; // back of the line
    this.length = 0;
  }

  // Add someone at the back
  enqueue(person) {
    const node = new WaitlistNode(person);
    if (this.tail === null) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.length++;
  }

  // Remove and return the person at the front
  dequeue() {
    if (this.head === null) return null;
    const node = this.head;
    this.head = node.next;
    if (this.head === null) this.tail = null;
    this.length--;
    return node.person;
  }

  // Look at the front person without removing them
  peek() {
    return this.head === null ? null : this.head.person;
  }

  isEmpty() {
    return this.length === 0;
  }
}

module.exports = { Waitlist };


